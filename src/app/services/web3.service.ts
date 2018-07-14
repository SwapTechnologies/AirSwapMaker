import { Injectable } from '@angular/core';

declare var require: any;
const Web3 = require('web3');

@Injectable({
  providedIn: 'root'
})
export class Web3Service {

  public _web3: any;

  constructor() { }

  get web3(): any {
    if (!this._web3) {
      this.connectInfura();
    }
    return this._web3;
  }

  set web3(web3: any) {
    this._web3 = web3;
  }

  connectInfura() {
    this._web3 = new Web3('https://mainnet.infura.io/506w9CbDQR8fULSDR7H0');
  }
}
