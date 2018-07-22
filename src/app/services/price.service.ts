import { Injectable } from '@angular/core';
import { AirswapService } from './airswap.service';
import { LogsService } from './logs.service';
import { Erc20Service } from './erc20.service';
import { HttpClient } from '@angular/common/http';
import { TimerObservable } from 'rxjs/observable/TimerObservable';

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

  constructor(
    public airswapService: AirswapService,
    public erc20Service: Erc20Service,
    private logsService: LogsService,
    private http: HttpClient
  ) {
    this.startContinuousPriceBalanceUpdating();
  }

  startContinuousPriceBalanceUpdating() {
    if (!this.priceUpdater) {
      this.priceUpdater = TimerObservable.create(0, 100)
      .subscribe( () => {
        this.updateCountdown = this.updateCountdown + 100 / 30000 * 100;
        if (this.updateCountdown >= 100) {
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

  setPricingLogic() {
    this.airswapService.asProtocol.RPC_METHOD_ACTIONS.getOrder = ((msg) => {
      const {
        makerAddress, // eslint-disable-line
        makerAmount, // eslint-disable-line
        makerToken,
        takerAddress,
        takerAmount, // eslint-disable-line
        takerToken,
      } = msg.params;

      console.log(msg);
      if (!makerAmount && !takerAmount) {
        return;
      }

      const makerProps = this.erc20Service.getToken(makerToken);
      const takerProps = this.erc20Service.getToken(takerToken);
      if (!makerProps || !takerProps) {
        return;
      }
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
        if (makerAmount) {
          this.logsService.addLog('Received order request from ' + takerAddress +
            ' to buy ' + makerAmount * (10 ** (-makerProps.decimals)) +
            ' ' + makerProps.symbol + ' with ' + takerProps.symbol);
        } else {
          this.logsService.addLog('Received order request from ' + takerAddress +
            ' to buy ' + makerProps.symbol + ' with ' +
            takerAmount * (10 ** (-takerProps.decimals)) + ' ' + takerProps.symbol);
        }

        let answerMakerAmount = makerAmount;
        let answerTakerAmount = takerAmount;

        // pricing logic
        if (this.limitPrices[makerToken] && this.limitPrices[makerToken][takerToken]) {
          if (makerAmount) {
            // Taker wants to buy a number of makerToken
            answerTakerAmount = this.erc20Service.toFixed(
              this.limitPrices[makerToken][takerToken] * makerAmount
            );
            this.logsService.addLog('Answering to sell for  ' +
              answerTakerAmount * (10 ** (-takerProps.decimals)) + ' ' +
              takerProps.symbol);
          } else {
            // Taker wants to sell a number of takerToken
            answerMakerAmount = this.erc20Service.toFixed(
              takerAmount / this.limitPrices[makerToken][takerToken]
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

          if (this.balances[makerToken] < Number(answerMakerAmount)) {
            this.logsService.addLog('Cancelled. You only have  ' +
            this.balances[makerToken] * (10 ** (-makerProps.decimals)) + ' ' +
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
          this.airswapService.asProtocol.call(
            takerAddress, // send order to address who requested it
            { id: msg.id, jsonrpc: '2.0', result: signedOrder }, // response id should match their `msg.id`
          );

          if (!this.openOrders[makerToken]) {
            this.openOrders[makerToken] = {};
          }

          const signature = signedOrder.v + signedOrder.r + signedOrder.s;
          const expirationTimer = TimerObservable.create(0, 1000)
          .subscribe( () => {
            const currentTime = Math.round(new Date().getTime() / 1000);
            // find a way to check if this transaction was taken and mined
            if (currentTime > expiration) {
              expirationTimer.unsubscribe();

              if (this.openOrders[makerToken][signature]) {
                delete this.openOrders[makerToken][signature];
                this.updateBalances();
              }
            }
          });
          this.openOrders[makerToken][signature] = signedOrder;
          this.updateBalances();
        }
      });
    });
  }

  getPriceOfToken(tokenSymbol: string): Promise<any> {
    return this.http.get(`https://min-api.cryptocompare.com/data/pricemulti?` +
    `fsyms=` + tokenSymbol + `&tsyms=USD`)
    .toPromise()
    .then((result) => {
      return result;
    });
  }

  getPricesOfList(tokenList: any): Promise<any> {
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
          priceToken = 0;
        } else {
          priceToken = priceToken['USD'];
        }
        usdPrices[token] = priceToken;
      }
      return usdPrices;
    });
  }

  removePriceOffer(makerToken, takerToken) {
    if (this.limitPrices[makerToken] &&
      this.limitPrices[makerToken][takerToken]) {
        delete this.limitPrices[makerToken][takerToken];
      }
  }

  getUsdPrices(): Promise<any> {
    this.updateCountdown = 0;
    const tokenSymbolList = [];
    for (const intent of this.airswapService.intents) {
      if (intent.makerProps && intent.takerProps) {
        if (!(tokenSymbolList.indexOf(intent.makerProps.symbol) >= 0)) {
          tokenSymbolList.push(intent.makerProps.symbol);
        }
        if (!(tokenSymbolList.indexOf(intent.takerProps.symbol) >= 0)) {
          tokenSymbolList.push(intent.takerProps.symbol);
        }
      }
    }

    return this.getPricesOfList(tokenSymbolList)
    .then((usdPrices) => {
      this.usdPrices = usdPrices;
      for (const intent of this.airswapService.intents) {
        if (intent.makerProps && intent.takerProps) {
          intent.price = this.usdPrices[intent.makerProps.symbol] / this.usdPrices[intent.takerProps.symbol];
        }
      }
      for (const token of this.airswapService.tokenList) {
        this.usdPricesByToken[token] = this.usdPrices[this.airswapService.tokenProps[token].symbol];
      }
    });
  }

  getBalances(): Promise<any> {
    const promiseList = [];
    // for (const token of this.tokenList) {
    for (const token of this.airswapService.tokenList) {
      promiseList.push(
        this.erc20Service.balance(token, this.airswapService.asProtocol.wallet.address)
        .then((balance) => {
          this.balances[token] = balance;
        })
      );
    }
    return Promise.all(promiseList).then(() => {
      this.updateBalances();
    });
  }

  updateBalances(): void {
    for (const token of this.airswapService.tokenList) {
      if (this.balancesLimits[token]) {
        this.balancesLiquidity[token] = this.balancesLimits[token];
      } else if (this.balances[token]) {
        this.balancesLiquidity[token] = this.balances[token];
      }
      if (this.openOrders[token]) {
        for (const signature in this.openOrders[token]) {
          if (this.openOrders[token][signature]) {
            this.balancesLiquidity[token] -= this.openOrders[token][signature].makerAmount;
          }
        }
      }
    }
  }

  getBalancesAndPrices(): Promise<any> {
    const promiseList = [];
    promiseList.push(this.getUsdPrices());
    promiseList.push(this.getBalances());
    return Promise.all(promiseList);
  }

}
