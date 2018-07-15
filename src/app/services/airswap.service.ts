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

  connect(privateKey: string) {
    this.asProtocol = new AirSwap({
      privateKey: privateKey,
      infuraKey: this.infuraAPI,
      networkId: 'mainnet'
    });
    this.asProtocol.connect()
    .then((result) => {
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

  logout(): void {
    this.asProtocol.disconnect();
    this.connected = false;
  }
}
