import { Injectable } from '@angular/core';
import { AirswapService } from './airswap.service';
import { LogsService } from './logs.service';
import { Erc20Service } from './erc20.service';
import { HttpClient } from '@angular/common/http';
import { TimerObservable } from 'rxjs/observable/TimerObservable';

import { AppConfig } from '../../environments/environment';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class PriceService {
  public tokenPairPrices = {};

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

  public lastCheckedBlocknumber: number;
  public lastTimestampPricecheck = 0;
  public algorithmCallbackOnUpdate = () => {};

  constructor(
    public airswapService: AirswapService,
    public erc20Service: Erc20Service,
    private logsService: LogsService,
    private http: HttpClient,
    private notificationService: NotificationService
  ) {
    this.startContinuousPriceBalanceUpdating();

    this.airswapService.connectedSubject.subscribe(connected => {
      if (connected) {
        this.airswapService.asProtocol.provider.getBlockNumber()
        .then(blocknumber => {
          this.notificationService.showMessage(
            'Connected to Ethereum, current blocknumber: ' + blocknumber
          );
          this.lastCheckedBlocknumber = blocknumber;
        });
      }
    });
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
    const currentTimestamp = Date.now();
    if (currentTimestamp - this.lastTimestampPricecheck < 10000 && this.updateCountdown >= 100) {
      this.updateCountdown = (Date.now() - this.lastTimestampPricecheck) / 300;
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

  emergencyShutdown() {
    this.notificationService.showMessage(
      'Emergency shutdown! Stop offering orders.',
      'Ok.'
    );
    this.tokenPairPrices = {};
    this.stopAlgorithm();
  }

  checkForFilledEvents(): Promise<any> {
    return this.airswapService.asProtocol.provider.getBlockNumber()
    .then(currentBlocknumber => {
      const lastBlocknumber = this.lastCheckedBlocknumber;
      if (currentBlocknumber > lastBlocknumber) {
        this.lastCheckedBlocknumber = currentBlocknumber;
        // always check a about 30s additionally back, to be sure that nothing is missed somehow
        return this.airswapService.getAirSwapLogs(lastBlocknumber - 3, currentBlocknumber);
      } else {
        return false;
      }
    }).then(logs => {
      if (logs && logs.length > 0) {
        const promiseList = [];
        for (const log of logs) {
          const hash = log.transactionHash;
          promiseList.push(
            this.airswapService.getAirSwapTransactionByHash(hash)
            .then(result => {
              if (result
                  && this.openOrders[result.makerToken]
                  && this.openOrders[result.makerToken][result.takerToken]
                  && this.openOrders[result.makerToken][result.takerToken][result.signature]) {
                const order = this.openOrders[result.makerToken][result.takerToken][result.signature];
                order.expirationTimer.unsubscribe(); // stop the countdown timer
                if (this.balancesLimits[result.makerToken] && this.balancesLimits[result.makerToken][result.takerToken]) {
                  // reduce limit of max amount you are selling of this token
                  this.balancesLimits[result.makerToken][result.takerToken] -= result.makerAmount;
                }

                // remove the order from the mapping, check if maps empty and remove them as well in case
                delete this.openOrders[result.makerToken][result.takerToken][result.signature];
                if (Object.keys(this.openOrders[result.makerToken][result.takerToken]).length === 0
                    && this.openOrders[result.makerToken][result.takerToken].constructor === Object) {
                  delete this.openOrders[result.makerToken][result.takerToken];
                  if (Object.keys(this.openOrders[result.makerToken]).length === 0
                    && this.openOrders[result.makerToken].constructor === Object) {
                    delete this.openOrders[result.makerToken];
                  }
                }
              }
            })
          );
        }
        // after all found logs have been dealt with
        return Promise.all(promiseList);
      } else {
        // no logs were found
        return false;
      }
    }).then(foundLogs => {
      if (foundLogs === false) {
        return false;
      } else {
        return this.getBalances(); // get current balances and update liquidity
      }
    }).then(gotBalances => {
      if (gotBalances === false) {
        return false;
      }

      if (this.algorithmRunning) {
        this.algorithmCallbackOnUpdate(); // tell algorithm that values might have been updated
      }
      return true;
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

      if (!this.tokenPairPrices[makerToken] || !this.tokenPairPrices[makerToken][takerToken]) {
        // no price set for pair
        console.log('No price set for this pair');
        return;
      }

      if (!this.balancesLiquidity[makerToken] || !this.balancesLiquidity[makerToken][takerToken]) {
        console.log('No liquidity set for this pair');
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
            this.tokenPairPrices[makerToken][takerToken] *
            makerAmount * 10 ** (-makerProps.decimals + takerProps.decimals)
          );
        } else {
          // Taker wants to sell a number of takerToken
          answerMakerAmount = this.erc20Service.toFixed(
            takerAmount / this.tokenPairPrices[makerToken][takerToken] *
            10 ** (makerProps.decimals - takerProps.decimals)
          );
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
          this.balancesLiquidity[makerToken][takerToken] * (10 ** (-makerProps.decimals)) + ' ' +
            makerProps.symbol);
          return;
        }

        this.notificationService.showMessage(
          'Giving order ' + answerTakerAmount * (10 ** (-takerProps.decimals)) + ' ' +
          takerProps.symbol + ' for  ' +
          answerMakerAmount * (10 ** (-makerProps.decimals)) + ' ' +
          makerProps.symbol
        );

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
        this.airswapService.asProtocol.call(
          takerAddress, // send order to address who requested it
          { id: msg.id, jsonrpc: '2.0', result: signedOrder }, // response id should match their `msg.id`
        );

        // store currently openOrder in a mapping for every maker Token
        if (!this.openOrders[makerToken]) {
          this.openOrders[makerToken] = {};
          if (!this.openOrders[makerToken][takerToken]) {
            this.openOrders[makerToken][takerToken] = {};
          }
        }
        const signature = '0x' + signedOrder.v.toString(16) + signedOrder.r.slice(2) + signedOrder.s.slice(2);
        // console.log('Saving signature in open orders.', signature);
        signedOrder.expirationTimer = TimerObservable.create(0, 1000)
        .subscribe( () => {
          const currentTime = Math.round(new Date().getTime() / 1000);
          // find a way to check if this transaction was taken and mined
          if (currentTime > expiration) {
            // when expiration timer is up, end the timer and delete the order
            // update the balances and if a algorithm is running notify it
            // that something may have updated
            signedOrder.expirationTimer.unsubscribe();
            if (this.openOrders[makerToken][takerToken][signature]) {
              // remove the order from the mapping, check if maps empty and remove them as well in case
              delete this.openOrders[makerToken][takerToken][signature];
              if (Object.keys(this.openOrders[makerToken][takerToken]).length === 0
                  && this.openOrders[makerToken][takerToken].constructor === Object) {
                delete this.openOrders[makerToken][takerToken];
                if (Object.keys(this.openOrders[makerToken]).length === 0
                  && this.openOrders[makerToken].constructor === Object) {
                  delete this.openOrders[makerToken];
                }
              }

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
        this.openOrders[makerToken][takerToken][signature] = signedOrder;
        this.updateLiquidity();
      });
    });
  }

  getPriceOfToken(tokenSymbol: string): Promise<any> {
    if (tokenSymbol === '' || tokenSymbol === undefined) {
      return Promise.resolve([]);
    }
    this.lastTimestampPricecheck = Date.now(); // to limit api calls to every 10s, log timestamp of every call
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
      if (!this.tokenPairPrices[makerAddress]) {
        this.tokenPairPrices[makerAddress] = {};
      }
      this.tokenPairPrices[makerAddress][takerAddress] = price;
    }
  }

  getPrice(makerAddress: string, takerAddress: string): number {
    if (this.tokenPairPrices[makerAddress]) {
      return this.tokenPairPrices[makerAddress][takerAddress];
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
    if (this.tokenPairPrices[makerToken]
        && this.tokenPairPrices[makerToken][takerToken]) {
      delete this.tokenPairPrices[makerToken][takerToken];
    }
  }

  removeAmountLimit(makerToken, takerToken) {
    if (this.balancesLimits[makerToken]
      && this.balancesLimits[makerToken][takerToken]) {
    delete this.balancesLimits[makerToken][takerToken];
    this.updateLiquidity();
    }
  }

  getUsdPrices(): Promise<any> {
    if (Date.now() - this.lastTimestampPricecheck < 10000) {
      return;
    }

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

      if (this.algorithmRunning) {
        // check if price of a previously set token has jumped significantly
        // for later: add here second source of pricing for cross check
        for (const price in usdPrices) {
          if (usdPrices[price] && this.usdPrices[price]) {
            const relChange = usdPrices[price] / this.usdPrices[price];
            if (relChange > 1.1 || relChange < 0.9) {
              // price jumped way to fast, there may be something wrong with the price feed
              // shut down
              this.notificationService.showMessage(
                'CryptoCompare price of ' + price +
                'jumped by more than 10% in one time interval. Before it was: ' +
                this.usdPrices[price] + '$ and then: ' + usdPrices[price] + '$'
              );
              this.emergencyShutdown();
              break;
            }
          }
        }
      }
      this.usdPrices = usdPrices;
      // make a mapping token -> price for further use
      for (const token of this.airswapService.tokenList) {
        this.usdPricesByToken[token] = this.usdPrices[this.airswapService.tokenProps[token].symbol];
      }

      this.updateIntentPrices();
    });
  }

  updateIntentPrices() {
    // note every price relative to the tokens within the intents itself
    for (const intent of this.airswapService.intents) {
      if (intent.makerProps && intent.takerProps
          && this.usdPrices[intent.makerProps.symbol] && this.usdPrices[intent.takerProps.symbol]) {
        intent.price = this.usdPrices[intent.makerProps.symbol] / this.usdPrices[intent.takerProps.symbol];
      }
    }
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
    // console.log('Balances Limits:', this.balancesLimits);
    // console.log('Open Orders:', this.openOrders);
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
    console.log(this.balancesLiquidity);
  }

  getBalancesAndPrices(): Promise<any> {
    const promiseList = [];
    promiseList.push(this.getUsdPrices());
    promiseList.push(this.checkForFilledEvents());
    promiseList.push(this.getBalances());
    return Promise.all(promiseList);
  }
}
