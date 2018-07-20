import { Injectable } from '@angular/core';
import * as AirSwap from './airswap/AirSwap.js';

import { AppConfig } from '../../environments/environment';

const fs = require('fs');
const path = require('path');
const electron = require('electron');

@Injectable({
  providedIn: 'root'
})
export class AirswapService {

  public connected = false;
  public asProtocol: any;
  private infuraAPI = '506w9CbDQR8fULSDR7H0';
  public intents = [];
  public locallyStoredIntents = {};
  constructor() { }

  connect(privateKey: string) {
    this.asProtocol = new AirSwap({
      privateKey: privateKey,
      infuraKey: this.infuraAPI,
      networkId: AppConfig.networkId,
    });
    this.asProtocol.connect()
    .then((result) => {
      this.connected = true;
      this.asProtocol.CALL_ON_CLOSE = this.onConnectionClose;
      const localIntents = this.locallyStoredIntents[this.asProtocol.wallet.address.toLowerCase()];
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

  getIntents(): Promise<any> {
    if (this.connected) {
      return this.asProtocol.getIntents()
      .then(result => {
        this.intents = result;
        this.storeIntentsToLocalFile();
        return result;
      });
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
}
