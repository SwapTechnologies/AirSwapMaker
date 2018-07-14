import { Injectable } from '@angular/core';
import { validatedTokens } from './validatedTokens/validatedTokens';
import { Token } from '../types/types';
import { erc20ABI } from './erc20ABI';
import { AirswapService } from './airswap.service';
import { Web3Service } from './web3.service';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class Erc20Service {

  public validatedTokens = validatedTokens;
  public erc20ABI = erc20ABI;
  public EtherAddress = '0x0000000000000000000000000000000000000000';

  constructor(
    public airswapService: AirswapService,
    public web3Service: Web3Service,
    private http: HttpClient
  ) { }

  getToken(address: string): Token {
    const validToken = validatedTokens.find(x => {
      return x.address === address;
    });
    if (validToken) {
      return validToken;
    } else {
      return null;
    }
  }

  getTokenByName(name: string): Token {
    const validToken = validatedTokens.find(x => {
      return x.name.toLowerCase() === name.toLowerCase()
             || x.symbol.toLowerCase() === name.toLowerCase();
    });

    if (validToken) {
      return validToken;
    } else {
      return null;
    }
  }

  isValidToken(address: string): boolean {
    const validToken = validatedTokens.find(x => {
      return x.address === address;
    });
    if (validToken) {
      return true;
    } else {
      return false;
    }
  }

  getValidatedTokens(): Token[] {
    this.validatedTokens = validatedTokens;
    for (const token of this.validatedTokens) {
      token.address = token.address.toLowerCase();
    }
    this.validatedTokens = this.validatedTokens.sort((a, b) => {
      if (a.name.toLowerCase() < b.name.toLowerCase()) { return -1; }
      if (a.name.toLowerCase() > b.name.toLowerCase()) { return 1; }
      return 0;
    });
    return this.validatedTokens;
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
    .allowance(this.airswapService.asProtocol.wallet.address, this.airswapService.asProtocol.exchangeContract.address)
    .call()
    .then(approvedAmount => approvedAmount);
  }

  approve(contract: any, spender: string): Promise<any> {
    let approveMethod;
    let gasPrice = 10e9;

    return this.http.get('https://ethgasstation.info/json/ethgasAPI.json')
    .toPromise()
    .then(ethGasStationResult => {
      if (ethGasStationResult['average']) {
        gasPrice = ethGasStationResult['average'] / 10 * 1e9;
      }
      return this.decimals(contract);
    }).then(decimals => {
      const largeApproval = this.toFixed(1e21 * 10 ** decimals);
      approveMethod = contract.methods
      .approve(spender, largeApproval);
      return approveMethod.estimateGas({from: this.airswapService.asProtocol.wallet.address});
    }).then(estimatedGas => {
      return approveMethod.send({
        from: this.airswapService.asProtocol.wallet.address,
        gas: Math.round(estimatedGas * 1.1),
        gasPrice: gasPrice
      });
    });
  }
}
