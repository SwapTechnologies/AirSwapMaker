import { Injectable } from '@angular/core';
import { AirswapService } from './airswap.service';
import { LogsService } from './logs.service';
import { Erc20Service } from './erc20.service';
import { HttpClient } from '@angular/common/http';
import { TimerObservable } from 'rxjs/observable/TimerObservable';

import { AppConfig } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PriceService {
  public limitPrices = {};
  public balances = {};
  public expirationTime = 300;

  public balancesLimits = {};
  public balancesLiquidity = {};

  public openOrders = {};

  public usdPrices = {};
  public usdPricesByToken = {};

  public updateCountdown = 100;

  public priceUpdater;
  public algorithmRunning = false;
  public blacklistAddress = {};

  public listeningToFilledEvent = false;
  public filledEventTopic = '0xe59c5e56d85b2124f5e7f82cb5fcc6d28a4a241a9bdd732704ac9d3b6bfc98ab';

  public algorithmCallbackOnUpdate = () => {};


  constructor(
    public airswapService: AirswapService,
    public erc20Service: Erc20Service,
    private logsService: LogsService,
    private http: HttpClient
  ) {
    this.startContinuousPriceBalanceUpdating();
  }

  startContinuousPriceBalanceUpdating() {
    if (!this.priceUpdater) { // if the price updater is not running, start it to update prices every 30s
      this.priceUpdater = TimerObservable.create(0, 100)
      .subscribe( () => {
        this.updateCountdown = this.updateCountdown + 100 / 30000 * 100;
        if (this.updateCountdown >= 100) {
          // if update countdown is at 100%, normally after 30s, refresh prices and your balances
          if (this.airswapService.connected) {
            this.getBalancesAndPrices()
            .then(() => {
              this.setPricingLogic();
            });
          }
        }
      });
    }
  }

  stopContinuousPriceBalanceUpdating() {
    this.priceUpdater.unsubscribe();
    this.priceUpdater = null;
  }

  startAlgorithm() {
    if (this.priceUpdater) {
      this.stopContinuousPriceBalanceUpdating();
    }
    this.algorithmRunning = true;
  }

  stopAlgorithm() {
    this.algorithmRunning = false;
  }

  listenToFilledEvents() {
    this.listeningToFilledEvent = true;
    console.log('Start listening on chain for Filled Events');
    this.airswapService.asProtocol.provider
    .on([this.filledEventTopic], (log) => {
      console.log('FilledEvent triggered', log);
      // filled event triggered, typical event:
      // { blockNumber: 6040052,
      //   blockHash: '0xa28581505c9ae495c7aa83d44d557a40dee62d1af954e68ccfa81d1ca9d3db99',
      //   transactionIndex: 94,
      //   removed: false,
      //   address: '0x8fd3121013A07C57f0D69646E86E7a4880b467b7',
      //   data: '0x0000000000000000000000000000000000000000000000000000000000000
      //     1f4000000000000000000000000063b30ca02db00d7172fe2f4db35d5f3d58a6f53
      //     0000000000000000000000000000000000000000000000000084170354bfbfff
      //     000000000000000000000000000000000000000000000000000000005b5b407e
      //     0000000000000000000000000000000000000000000000000000000003bfe02b',
      //   topics:
      //    [ '0xe59c5e56d85b2124f5e7f82cb5fcc6d28a4a241a9bdd732704ac9d3b6bfc98ab',
      //      '0x00000000000000000000000069c2983f1289be1297eed90b404abf902c8403c6',
      //      '0x000000000000000000000000aec2e87e0a235266d9c5adc9deb4b2e29b54d009',
      //      '0x0000000000000000000000000000000000000000000000000000000000000000' ],
      //   transactionHash: '0x624deac09ea059caea62143be6e27d00eab0bf4b24d039139b7fed86f76d5267',
      //   logIndex: 55 }
      const addressLogs = log.address;
      const makerAddress = '0x' + log.topics[1].slice(26, 66).toLowerCase();
      const makerToken = '0x' + log.topics[2].slice(26, 66).toLowerCase();
      const takerToken = '0x' + log.topics[3].slice(26, 66).toLowerCase();
      if (addressLogs === AppConfig.astProtocolAddress
          && makerAddress === this.airswapService.asProtocol.wallet.address.toLowerCase()) {
        // pass

      }

    });
  }

  setPricingLogic() {
    this.airswapService.asProtocol.RPC_METHOD_ACTIONS.getOrder = ((msg) => {
      const {
        makerAddress,
        makerAmount,
        makerToken,
        takerAddress,
        takerAmount,
        takerToken,
      } = msg.params;

      if (this.blacklistAddress[takerAddress]) {
        // ignore blacklisted addresses
        return;
      }
      console.log(msg);
      if (!makerAmount && !takerAmount) {
        // neither makerAmount nor takerAmount are set -> dont do anything.
        return;
      }
      if (makerAmount && takerAmount) {
        // both values are preset
        // we don't do that here
        return;
      }

      const makerProps = this.erc20Service.getToken(makerToken);
      const takerProps = this.erc20Service.getToken(takerToken);
      if (!makerProps || !takerProps) {
        // at least one of two tokens are not known to you -> don't do anything
        return;
      }

      if (!this.limitPrices[makerToken] || !this.limitPrices[makerToken][takerToken]) {
        // no price set for pair
        return;
      }

      if (!this.balancesLiquidity[makerToken] || !this.balancesLiquidity[makerToken][takerToken]) {
        // no liquidity for pair
        return;
      }

      // get current balances of the taker and the maker
      let takerMakerBalance = 0;
      let takerTakerBalance = 0;
      const promiseList = [];
      Promise.all([
        this.erc20Service.balance(makerToken, takerAddress)
        .then((balance) => {
          takerMakerBalance = balance;
        }),
        this.erc20Service.balance(takerToken, takerAddress)
        .then((balance) => {
          takerTakerBalance = balance;
        })
      ]).then(() => {
        // with the tokens & balances known, start making a response
        if (makerAmount) {
          this.logsService.addLog('Received order request from ' + takerAddress +
            ' to buy ' + makerAmount * (10 ** (-makerProps.decimals)) +
            ' ' + makerProps.symbol + ' with ' + takerProps.symbol);
        } else {
          this.logsService.addLog('Received order request from ' + takerAddress +
            ' to buy ' + makerProps.symbol + ' with ' +
            takerAmount * (10 ** (-takerProps.decimals)) + ' ' + takerProps.symbol);
        }

        // one is undefined of the two and will be filled in the next step
        let answerMakerAmount = makerAmount;
        let answerTakerAmount = takerAmount;

        if (makerAmount) {
          // Taker wants to buy a number of makerToken
          answerTakerAmount = this.erc20Service.toFixed(
            this.limitPrices[makerToken][takerToken] *
            makerAmount * 10 ** (-makerProps.decimals + takerProps.decimals)
          );
          this.logsService.addLog('Answering to sell for  ' +
            answerTakerAmount * (10 ** (-takerProps.decimals)) + ' ' +
            takerProps.symbol);
        } else {
          // Taker wants to sell a number of takerToken
          answerMakerAmount = this.erc20Service.toFixed(
            takerAmount / this.limitPrices[makerToken][takerToken] *
            10 ** (makerProps.decimals - takerProps.decimals)
          );
          this.logsService.addLog('Answering to buy for  ' +
            answerMakerAmount * (10 ** (-makerProps.decimals)) + ' ' +
            makerProps.symbol);
        }

        // check if both parties have enough balance
        if (takerTakerBalance < Number(answerTakerAmount)) {
          this.logsService.addLog('Cancelled. Counterparty only has ' +
            takerTakerBalance * (10 ** (-takerProps.decimals)) + ' ' +
            takerProps.symbol);
          return;
        }

        if (this.balancesLiquidity[makerToken][takerToken] < Number(answerMakerAmount)) {
          this.logsService.addLog('Cancelled. Your liquid balance is only  ' +
          this.balancesLiquidity[makerToken] * (10 ** (-makerProps.decimals)) + ' ' +
            makerProps.symbol);
          return;
        }

        const expiration = Math.round(new Date().getTime() / 1000) + this.expirationTime;
        const nonce = String((Math.random() * 100000).toFixed());
        const signedOrder = this.airswapService.asProtocol.signOrder({
          makerAddress: this.airswapService.asProtocol.wallet.address.toLowerCase(),
          makerAmount: answerMakerAmount.toString(),
          makerToken,
          takerAddress,
          takerAmount: answerTakerAmount.toString(),
          takerToken,
          expiration,
          nonce,
        });

        // testmode, dont send it
        console.log('answer:', signedOrder);
        // this.airswapService.asProtocol.call(
        //   takerAddress, // send order to address who requested it
        //   { id: msg.id, jsonrpc: '2.0', result: signedOrder }, // response id should match their `msg.id`
        // );

        // store currently openOrder in a mapping for every maker Token
        if (!this.openOrders[makerToken]) {
          this.openOrders[makerToken] = {};
          if (!this.openOrders[makerToken][takerToken]) {
            this.openOrders[makerToken][takerToken] = {};
          }
        }
        const signature = signedOrder.v + signedOrder.r + signedOrder.s;
        const expirationTimer = TimerObservable.create(0, 1000)
        .subscribe( () => {
          const currentTime = Math.round(new Date().getTime() / 1000);
          // find a way to check if this transaction was taken and mined
          if (currentTime > expiration) {
            // when expiration timer is up, end the timer and delete the order
            // update the balances and if a algorithm is running notify it
            // that something may have updated
            expirationTimer.unsubscribe();
            if (this.openOrders[makerToken][takerToken][signature]) {
              delete this.openOrders[makerToken][takerToken][signature];

              // check if transaction was actually mined?
              this.getBalancesAndPrices()
              .then(() => {
                this.updateLiquidity(); // calculate the new liquid balances
                if (this.algorithmRunning) {
                  this.algorithmCallbackOnUpdate();
                }
              });
            }
          }
        });
        this.openOrders[makerToken][signature] = signedOrder;
        this.updateLiquidity();
      });
    });
  }

  getPriceOfToken(tokenSymbol: string): Promise<any> {
    // http request to cryptocompare for current token prices
    return this.http.get(`https://min-api.cryptocompare.com/data/pricemulti?` +
    `fsyms=` + tokenSymbol + `&tsyms=USD`)
    .toPromise()
    .then((result) => {
      return result;
    });
  }

  getPricesOfList(tokenList: any): Promise<any> {
    // get prices for a bunch of cryptocurrencies in one call
    // warning: limited to ~50 tokens atm from the cryptocompare side
    // to do: consider case of > 50 tokens
    let tokenString = tokenList[0];
    for (let i = 1; i < tokenList.length; ++i) {
      const token = tokenList[i];
      tokenString = tokenString + ',' + token;
    }
    return this.getPriceOfToken(tokenString)
    .then(prices => {
      const usdPrices = {};
      for (const token of tokenList) {
        let priceToken = prices[token];
        if (!priceToken) {
          priceToken = null;
        } else {
          priceToken = priceToken['USD'];
        }
        usdPrices[token] = priceToken;
      }
      return usdPrices;
    });
  }

  setPrice(makerAddress: string, takerAddress: string, price: number) {
    if (price > 0) {
      if (!this.limitPrices[makerAddress]) {
        this.limitPrices[makerAddress] = {};
      }
      this.limitPrices[makerAddress][takerAddress] = price;
    }
  }

  getPrice(makerAddress: string, takerAddress: string): number {
    if (this.limitPrices[makerAddress]) {
      return this.limitPrices[makerAddress][takerAddress];
    } else {
      return null;
    }
  }

  setLimitAmount(makerAddress: string, takerAddress: string, amount: number) {
    if (!this.balancesLimits[makerAddress]) {
      this.balancesLimits[makerAddress] = {};
    }
    this.balancesLimits[makerAddress][takerAddress] = Math.floor(amount);
  }

  getLimitAmount(makerAddress: string, takerAddress: string): number {
    if (this.balancesLimits[makerAddress]) {
      return this.balancesLimits[makerAddress][takerAddress];
    } else {
      return null;
    }
  }

  removePriceOffer(makerToken, takerToken) {
    // function to remove answering requests of a certain token pair
    if (this.limitPrices[makerToken] &&
      this.limitPrices[makerToken][takerToken]) {
        delete this.limitPrices[makerToken][takerToken];
      }
  }

  getUsdPrices(): Promise<any> {
    this.updateCountdown = 0; // reset timer in any case, try not to have too many api calls to cryptocompare

    // make a list of all token symbols in the intents
    const tokenSymbolList = [];
    for (const tokenAddress of this.airswapService.tokenList) {
      tokenSymbolList.push(this.airswapService.tokenProps[tokenAddress].symbol);
    }
    return this.getPricesOfList(tokenSymbolList)
    .then((usdPrices) => {

      // crypto compare doesnt know WETH prices
      usdPrices['WETH'] = usdPrices['ETH'];
      this.usdPrices = usdPrices;
      // make a mapping token -> price for further use
      for (const token of this.airswapService.tokenList) {
        this.usdPricesByToken[token] = this.usdPrices[this.airswapService.tokenProps[token].symbol];
      }

      // note every price relative to the tokens within the intents itself
      for (const intent of this.airswapService.intents) {
        if (intent.makerProps && intent.takerProps
            && this.usdPrices[intent.makerProps.symbol] && this.usdPrices[intent.takerProps.symbol]) {
          intent.price = this.usdPrices[intent.makerProps.symbol] / this.usdPrices[intent.takerProps.symbol];
        }
      }
    });
  }

  getBalances(): Promise<any> {
    const promiseList = [];
    const newBalances = {};

    for (const token of this.airswapService.tokenList) {
      promiseList.push(
        this.erc20Service.balance(token, this.airswapService.asProtocol.wallet.address)
        .then((balance) => {
          newBalances[token] = balance;
        })
      );
    }
    return Promise.all(promiseList).then(() => {
      this.balances = newBalances;
      this.updateLiquidity();
    });
  }

  updateLiquidity(): void {
    const balancesLiquidity = {};
    for (const makerToken in this.balancesLimits) {
      if (this.balancesLimits[makerToken]) {
        // check all tokens you are market making
        if (!balancesLiquidity[makerToken]) {
          balancesLiquidity[makerToken] = {};
        }
        for (const takerToken in this.balancesLimits[makerToken]) {
          if (this.balances[makerToken] !== undefined && this.balancesLimits[makerToken][takerToken] !== undefined) {
            // check all pairs you are market making the token with
            balancesLiquidity[makerToken][takerToken] = Math.min(
              this.balancesLimits[makerToken][takerToken],
              this.balances[makerToken]
            );

            if (this.openOrders[makerToken] && this.openOrders[makerToken][takerToken]) {
              for (const signature in this.openOrders[makerToken][takerToken]) {
                if (this.openOrders[makerToken][takerToken][signature]) {
                  // check all open orders you have sent out for that specific pair
                  balancesLiquidity[makerToken][takerToken] -= this.openOrders[makerToken][takerToken][signature].makerAmount;
                }
              }
            }
          }
        }
      }
    }
    this.balancesLiquidity = balancesLiquidity;
  }

  getBalancesAndPrices(): Promise<any> {
    const promiseList = [];
    promiseList.push(this.getUsdPrices());
    promiseList.push(this.getBalances());
    return Promise.all(promiseList);
  }
}
