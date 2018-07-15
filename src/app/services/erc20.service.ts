import { Injectable } from '@angular/core';
import { Token } from '../types/types';
import { erc20ABI } from './erc20ABI';
import { AirswapService } from './airswap.service';
import { Web3Service } from './web3.service';
import { HttpClient } from '@angular/common/http';

const fs = require('fs');
const path = require('path');
const electron = require('electron');

@Injectable({
  providedIn: 'root'
})
export class Erc20Service {

  public tokens = {};
  public tokensByName = {};
  public tokensBySymbol = {};
  public tokenList = [];


  public tokenPath: string;
  public customTokens = [];
  public erc20ABI = erc20ABI;
  public EtherAddress = '0x0000000000000000000000000000000000000000';

  constructor(
    public airswapService: AirswapService,
    public web3Service: Web3Service,
    private http: HttpClient
  ) {
    const userDataPath = (electron.app || electron.remote.app).getPath('userData');
    this.tokenPath = path.join(userDataPath, 'erc20Tokens.json');
    try {
      this.tokens = JSON.parse(fs.readFileSync(this.tokenPath));
      this.generateTokensTwins();
    } catch (error) {
      http.get('https://token-metadata.airswap.io/tokens')
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
        fs.writeFileSync(this.tokenPath, JSON.stringify(this.tokens));
        this.generateTokensTwins();
      });
    }
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
    this.generateTokensTwins();
    fs.writeFileSync(this.tokenPath, JSON.stringify(this.tokens));
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
      .then(balance => balance);
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
    .allowance(this.airswapService.asProtocol.wallet.address, spender)
    .call()
    .then(approvedAmount => approvedAmount);
  }

  approvedAmountAirSwap(contract: any): Promise<number> {
    return contract.methods
    .allowance(this.airswapService.asProtocol.wallet.address,
               this.airswapService.asProtocol.exchangeContract.address)
    .call()
    .then(approvedAmount => approvedAmount);
  }

  approve(contractAddress): Promise<any> {
    let gasPrice = 10e9;
    return this.http.get('https://ethgasstation.info/json/ethgasAPI.json')
    .toPromise()
    .then(ethGasStationResult => {
      if (ethGasStationResult['average']) {
        gasPrice = ethGasStationResult['average'] / 10 * 1e9;
      }
      return this.airswapService.asProtocol.approveTokenForTrade(
        contractAddress,
        {
          gasPrice: gasPrice
        });
    });
  }
}
