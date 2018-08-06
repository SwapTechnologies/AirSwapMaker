import { Injectable } from '@angular/core';
import { AppConfig } from '../../environments/environment';
declare var require: any;
const Web3 = require('web3');

@Injectable({
  providedIn: 'root'
})
export class Web3Service {

  public _web3: any;

  public connectedAddress: string;
  public astDexAddress: string;

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
    this._web3 = new Web3('https://' + AppConfig.networkId + '.infura.io/506w9CbDQR8fULSDR7H0');
  }

  getBalance(address) {
    return this.web3.eth.getBalance(address)
    .then(result => {
      return result;
    });
  }
}
