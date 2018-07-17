import { Injectable } from '@angular/core';
import { AirswapService } from './airswap.service';
import { LogsService } from './logs.service';
import { Erc20Service } from './erc20.service';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class PriceService {
  public limitPrices = {};
  public balances = {};
  public expirationTime = 300;

  constructor(
    public airswapService: AirswapService,
    public erc20Service: Erc20Service,
    private logsService: LogsService,
    private http: HttpClient
  ) { }

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
          if (Number(makerAmount) > this.balances[makerToken]) {
            return;
          }
          answerTakerAmount = this.erc20Service.toFixed(
            this.limitPrices[makerToken][takerToken] * makerAmount
          );
          this.logsService.addLog('Answering to sell for  ' +
            answerTakerAmount * (10 ** (-takerProps.decimals)) + ' ' +
            takerProps.symbol);
        } else {
          answerMakerAmount = this.erc20Service.toFixed(
            takerAmount / this.limitPrices[makerToken][takerToken]
          );
          if (Number(answerMakerAmount) > this.balances[makerToken]) {
            return;
          }
          this.logsService.addLog('Answering to buy for  ' +
            answerMakerAmount * (10 ** (-makerProps.decimals)) + ' ' +
            makerProps.symbol);
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
      }
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
}
