import { Injectable } from '@angular/core';
import { AirswapService } from './airswap.service';
import { Erc20Service } from './erc20.service';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class PriceService {
  public limitPrices = {};
  constructor(
    public airswapService: AirswapService,
    public erc20Service: Erc20Service,
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

      // Expiration in _seconds_ since the epoch (Solidity uses seconds not ms)
      const expiration = Math.round(new Date().getTime() / 1000) + 300;
      const nonce = String((Math.random() * 100000).toFixed());

      let answerMakerAmount = makerAmount;
      let answerTakerAmount = takerAmount;

      // pricing logic
      if (this.limitPrices[makerToken] && this.limitPrices[makerToken][takerToken]) {
        if (makerAmount) {
          answerTakerAmount = this.erc20Service.toFixed(
            this.limitPrices[makerToken][takerToken] * makerAmount
          );
        } else if (takerAmount) {
          answerMakerAmount = this.erc20Service.toFixed(
            takerAmount / this.limitPrices[makerToken][takerToken]
          );
        } else {
          return;
        }

        const signedOrder = this.airswapService.asProtocol.signOrder({
          makerAddress: this.airswapService.asProtocol.wallet.address.toLowerCase(),
          makerAmount: answerMakerAmount,
          makerToken,
          takerAddress,
          takerAmount: answerTakerAmount,
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

  getPricesOfPair(tokenSymbol1: string, tokenSymbol2: string): Promise<any> {
    return this.getPriceOfToken(tokenSymbol1 + ',' + tokenSymbol2)
    .then(priceResult => {
      if (priceResult) {
        let priceMakerToken = priceResult[tokenSymbol1];
        if (!priceMakerToken) {
          priceMakerToken = 0;
        } else {
          priceMakerToken = priceMakerToken['USD'];
        }
        let priceTakerToken = priceResult[tokenSymbol2];
        if (!priceTakerToken) {
          priceTakerToken = 0;
        } else {
          priceTakerToken = priceTakerToken['USD'];
        }
        return {
          makerToken: priceMakerToken,
          takerToken: priceTakerToken
        };
      } else {
        return {
          makerToken: 0,
          takerToken: 0
        };
      }
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
}
