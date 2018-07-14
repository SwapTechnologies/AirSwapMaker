import { Injectable } from '@angular/core';

import * as AirSwap from './airswap/AirSwap.js';

@Injectable({
  providedIn: 'root'
})
export class AirswapService {

  public connected = false;
  public asProtocol: any;
  private infuraAPI = '506w9CbDQR8fULSDR7H0';
  public intents = [];
  constructor() { }

  connect(privateKey) {
    console.log('connecting....');
    this.asProtocol = new AirSwap({
      privateKey: privateKey,
      infuraKey: this.infuraAPI,
      networkId: 'rinkeby'
    });
    this.asProtocol.connect()
    .then((result) => {
      console.log(result);
      this.connected = true;
      this.getIntents();
    }).catch((error) => {
      console.log('Error.');
    });
  }

  getIntents(): Promise<any> {
    if (this.connected) {
      return this.asProtocol.getIntents()
      .then(result => {
        this.intents = result;
        return result;
      });
    }
  }
  setIntents(intents): Promise<any> {
    if (this.connected) {
      return this.asProtocol.setIntents(intents)
      .then(result => {
        return result;
      });
    }
  }
  getAccount(): string {
    return this.asProtocol.wallet.address;
  }

  get isAuthenticated(): boolean {
    return this.asProtocol.isAuthenticated;
  }
}
