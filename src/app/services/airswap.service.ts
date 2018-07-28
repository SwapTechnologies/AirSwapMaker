import { Injectable } from '@angular/core';
import * as AirSwap from './airswap/AirSwap.js';

import { AppConfig } from '../../environments/environment';
import { Erc20Service } from './erc20.service';
import { Web3Service } from './web3.service';
import { HttpClient } from '@angular/common/http';

const fs = require('fs');
const path = require('path');
const electron = require('electron');

@Injectable({
  providedIn: 'root'
})
export class AirswapService {

  public connected = false;
  public asProtocol: any;

  public intents = [];

  public tokenList = [];
  public tokenProps = {};

  public tokensInApprovalPending = {};
  public locallyStoredIntents = {};

  public astBalance = 0;
  public remainingIntents = 0;


  constructor(
    private erc20Service: Erc20Service,
    private http: HttpClient,
    private web3Service: Web3Service,
  ) { }

  connect(privateKey: string): Promise<any> {
    this.asProtocol = new AirSwap({
      privateKey: privateKey,
      infuraKey: AppConfig.infuraKey,
      networkId: AppConfig.networkId,
    });
    return this.asProtocol.connect()
    .then((result) => {
      this.connected = true;
      this.web3Service.connectedAddress = this.asProtocol.wallet.address.toLowerCase();
      this.web3Service.astDexAddress = this.asProtocol.exchangeContract.address;

      this.asProtocol.CALL_ON_CLOSE = this.onConnectionClose;
      const localIntents = this.locallyStoredIntents[this.web3Service.connectedAddress];
      if (localIntents) {
        this.setIntents(localIntents)
        .then(() => {
          this.getIntents(); // reload from indexer to be certain it's sync'd, sets the intents array
        });
      } else {
        this.getIntents(); // no local file? check if there are intents set anyway
      }
    }).catch((error) => {
      console.log('Error.');
    });
  }

  determineAstBalanceAndRemainingIntents(): Promise<any> {
    return this.erc20Service.balance(
      AppConfig.astAddress,
      this.asProtocol.wallet.address
    ).then(balance => {
      this.astBalance = balance / 1e4;
      this.remainingIntents = Math.floor((this.astBalance - 250 * this.intents.length) / 250);
    });
  }

  getIntents(): Promise<any> {
    if (this.connected) {
      // always include eth in tokenList
      const tokenList = [AppConfig.ethAddress];
      const tokenProps = {};

      const ethProps = this.erc20Service.getToken(AppConfig.ethAddress);
      ethProps['powerDecimals'] = 1e18;
      tokenProps[AppConfig.ethAddress] = ethProps;

      return this.asProtocol.getIntents()
      .then(result => {
        this.intents = result;
        for (const intent of this.intents) {
          const makerProps = this.erc20Service.getToken(intent.makerToken.toLowerCase());
          const takerProps = this.erc20Service.getToken(intent.takerToken.toLowerCase());
          if (makerProps && takerProps) {
            intent.makerProps = makerProps;
            intent.takerProps = takerProps;
            intent.makerProps.powerDecimals = 10 ** makerProps.decimals;
            intent.takerProps.powerDecimals = 10 ** takerProps.decimals;

            if (!(tokenList.indexOf(intent.makerProps.address) >= 0)) {
              tokenList.push(intent.makerProps.address);
              tokenProps[intent.makerProps.address] = intent.makerProps;
            }
            if (!(tokenList.indexOf(intent.takerProps.address) >= 0)) {
              tokenList.push(intent.takerProps.address);
              tokenProps[intent.takerProps.address] = intent.takerProps;
            }
          }
        }

        this.tokenList = tokenList;
        this.tokenProps = tokenProps;
        this.remainingIntents = Math.floor((this.astBalance - 250 * this.intents.length) / 250);
        this.storeIntentsToLocalFile();
        return result;
      });
    }
  }

  addTokenToList(token) {
    if (this.tokenProps[token.address] === undefined) {
      const tokenProps = this.erc20Service.getToken(token.address);
      if (tokenProps) {
        this.tokenList.push(tokenProps.address);
        tokenProps['powerDecimals'] = 10 ** tokenProps.decimals;
        this.tokenProps[tokenProps.address] = tokenProps;
      }
    }
  }

  removeTokenFromList(tokenAddress) {
    const idx = this.tokenList.indexOf(tokenAddress);
    if (idx > -1) {
      this.tokenList.splice(idx, 1);
      delete this.tokenProps[tokenAddress];
    }
  }

  setIntents(intents): Promise<any> {
    if (this.connected) {
      const intentList = [];
      for (const intent of intents) {
        intentList.push({
          makerToken: intent.makerToken,
          role: intent.role,
          takerToken: intent.takerToken
        });
      }
      return this.asProtocol.setIntents(intentList)
      .then(result => {
        this.storeIntentsToLocalFile();
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
    this.storeIntentsToLocalFile();
    this.setIntents([]); // remove intents from indexer
    this.onConnectionClose();
    this.asProtocol.disconnect();
  }

  onConnectionClose(): void {
    console.log('the connection is being closed.');
    this.connected = false;
  }

  storeIntentsToLocalFile() {
    // store current intents to local file
    const userDataPath = (electron.app || electron.remote.app).getPath('userData');
    const userIntentsPath = path.join(userDataPath, 'userIntents.json');
    const intentList = [];
    for (const intent of this.intents) {
      intentList.push({
        makerToken: intent.makerToken,
        role: intent.role,
        takerToken: intent.takerToken
      });
    }
    this.locallyStoredIntents[this.asProtocol.wallet.address.toLowerCase()] = intentList;
    fs.writeFileSync(userIntentsPath, JSON.stringify(this.locallyStoredIntents));
  }

  loadIntentsFromLocalFile() {
    // check if there are intents locally stored on start up
    const userDataPath = (electron.app || electron.remote.app).getPath('userData');
    const userIntentsPath = path.join(userDataPath, 'userIntents.json');
    try {
      const intents = JSON.parse(fs.readFileSync(userIntentsPath));
      this.locallyStoredIntents = intents;
    } catch (error) {
      // no local intents found
    }
  }

  approvedAmountAirSwap(contract: any): Promise<number> {
    return contract.methods
    .allowance(this.web3Service.connectedAddress,
               this.web3Service.astDexAddress)
    .call()
    .then(approvedAmount => approvedAmount);
  }

  getGasPrice(): Promise<any> {
    let gasPrice = 10e9;
    return this.http.get('https://ethgasstation.info/json/ethgasAPI.json')
    .toPromise()
    .then(ethGasStationResult => {
      if (ethGasStationResult['average']) {
        gasPrice = ethGasStationResult['average'] / 10 * 1e9;
      }
      return gasPrice;
    });
  }

  approve(contractAddress, gasPrice?: number): Promise<any> {
    if (gasPrice) {
      return this.asProtocol.approveTokenForTrade(
        contractAddress,
        {
          gasPrice: gasPrice
        }).then(result => {
          const hash = result.hash;
          this.tokensInApprovalPending[contractAddress] = hash;
          return hash;
        });
    } else {
      return this.getGasPrice()
      .then(estimatedGasPrice => {
        return this.asProtocol.approveTokenForTrade(
          contractAddress,
          {
            gasPrice: estimatedGasPrice
          });
      }).then(result => {
        console.log(result);
        const hash = result.hash;
        this.tokensInApprovalPending[contractAddress] = hash;
        return hash;
      });
    }
  }

  constructIntent(makerAddress, takerAddress): any {
    return {
      'makerToken': makerAddress.toLowerCase(),
      'takerToken': takerAddress.toLowerCase(),
      'role': 'maker'
    }
  }
}
