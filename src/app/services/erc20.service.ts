import { Injectable } from '@angular/core';
import { Token } from '../types/types';
import { erc20ABI } from './erc20ABI';
import { Web3Service } from './web3.service';
import { HttpClient } from '@angular/common/http';
import { AppConfig } from '../../environments/environment';

import * as electron from 'electron';

const fs = require('fs');
const path = require('path');


@Injectable({
  providedIn: 'root'
})
export class Erc20Service {

  public tokens = {};
  public userTokens = {};

  public tokensByName = {};
  public tokensBySymbol = {};
  public tokenList = [];

  public userTokenPath: string;
  public customTokens = [];
  public erc20ABI = erc20ABI;
  public EtherAddress = '0x0000000000000000000000000000000000000000';

  constructor(
    public web3Service: Web3Service,
    private http: HttpClient
  ) {
    // read ast metadata on first load up
    this.http.get(AppConfig.tokenMetadata)
    .toPromise()
    .then((result) => {
      this.tokens = {};
      for (const entry in result) {
        if (result[entry]) {
          const token = result[entry];
          this.tokens[token.address] = {
            address: token.address,
            name: token.name,
            symbol: token.symbol,
            decimals: Number(token.decimals),
          };
        }
      }

      // check for user tokens
      if (AppConfig.networkId === 'mainnet') {
        const userDataPath = (electron.app || electron.remote.app).getPath('userData');
        this.userTokenPath = path.join(userDataPath, 'userErc20Tokens.json');
        try {
          this.userTokens = JSON.parse(fs.readFileSync(this.userTokenPath));
          for (const token in this.userTokens) {
            if (this.userTokens[token]) {
              this.tokens[token] = this.userTokens[token];
            }
          }
        } catch (error) {
          // no user tokens
        }
      }
      this.generateTokensTwins();
    });
  }

  generateTokensTwins() {
    this.tokensByName = {};
    this.tokensBySymbol = {};
    this.tokenList = [];
    for (const tokenAddress in this.tokens) {
      if (this.tokens[tokenAddress]) {
        const token = this.tokens[tokenAddress];
        this.tokensByName[token.name.toLowerCase()] = token;
        this.tokensBySymbol[token.symbol.toLowerCase()] = token;
        this.tokenList.push(token);
      }
    }
    // sort tokenList
    this.tokenList.sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      if (nameA < nameB) {
        return -1;
      }
      if (nameA > nameB) {
        return 1;
      }
      return 0;
    });
  }

  getToken(address: string): Token {
    const validToken = this.tokens[address];
    if (validToken) {
      return validToken;
    } else {
      return null;
    }
  }

  getTokenByName(name: string): Token {
    let validToken = this.tokensByName[name.toLowerCase()];
    if (!validToken) {
      validToken = this.tokensBySymbol[name.toLowerCase()];
    }
    if (validToken) {
      return validToken;
    } else {
      return null;
    }
  }

  addToken(newToken: Token) {
    this.tokens[newToken.address] = newToken;
    this.userTokens[newToken.address] = newToken;
    this.generateTokensTwins();
    fs.writeFileSync(this.userTokenPath, JSON.stringify(this.userTokens));
  }

  getContract(address): any {
    return new this.web3Service.web3.eth.Contract(
      this.erc20ABI, address);
  }

  toFixed(x) {
    x = Math.floor(x);
    if (Math.abs(x) < 1.0) {
      const e = parseInt(x.toString().split('e-')[1], 10);
      if (e) {
          x *= Math.pow(10, e - 1);
          x = '0.' + (new Array(e)).join('0') + x.toString().substring(2);
      }
    } else {
      let e = parseInt(x.toString().split('+')[1], 10);
      if (e > 20) {
          e -= 20;
          x /= Math.pow(10, e);
          x += (new Array(e + 1)).join('0');
      }
    }
    return x;
  }

  decimals(contract: any): Promise<number> {
    return contract.methods.decimals().call()
    .then(decimals => decimals);
  }

  balance(tokenAddress: any, address: string): Promise<number> {
    if (tokenAddress === this.EtherAddress) {
      return this.web3Service.getBalance(address);
    } else {
      const contract = this.getContract(tokenAddress);
      return contract.methods
      .balanceOf(address)
      .call()
      .then(balance => {
        return balance;
      });
    }
  }

  symbol(contract: any): Promise<string> {
    return contract.methods
    .symbol()
    .call()
    .then(symbol => symbol);
  }

  name(contract: any): Promise<string> {
    return contract.methods
    .name()
    .call()
    .then(name => name);
  }

  approvedAmount(contract: any, spender): Promise<number> {
    return contract.methods
    .allowance(this.web3Service.connectedAddress, spender)
    .call()
    .then(approvedAmount => approvedAmount);
  }
}
