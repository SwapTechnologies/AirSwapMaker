import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { AirswapService } from '../../services/airswap.service';
import { Erc20Service } from '../../services/erc20.service';
import { Web3Service } from '../../services/web3.service';

@Component({
  selector: 'app-add-token',
  templateUrl: './add-token.component.html',
  styleUrls: ['./add-token.component.scss']
})
export class AddTokenComponent implements OnInit {
  public tokenAddress: string;
  public tokenName: string;
  public tokenSymbol: string;
  public tokenDecimals: number;
  public tokenCanApprove: boolean;

  public checkedToken = false;
  public tokenIsValid = false;
  public errorMessage: string;

  constructor(
    public dialogRef: MatDialogRef<AddTokenComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private airswapService: AirswapService,
    private erc20Service: Erc20Service,
    private web3Service: Web3Service,
  ) { }

  ngOnInit() {
  }

  onNoClick(): void {
    this.dialogRef.close(false);
  }

  onCloseConfirm() {
    this.dialogRef.close(true);
  }

  onCloseCancel() {
    this.dialogRef.close(false);
  }

  addToken(): void {
    if (this.tokenIsValid) {
      this.erc20Service.addToken({
        address: this.tokenAddress,
        name: this.tokenName,
        symbol: this.tokenSymbol,
        decimals: Number(this.tokenDecimals)
      });
      this.onCloseConfirm();
    } else {
      this.onCloseCancel();
    }
  }

  checkToken(): void {
    this.checkedToken = false;
    this.tokenName = null;
    this.tokenSymbol = null;
    this.tokenDecimals = null;
    if (this.tokenAddress) {
      this.tokenAddress = this.tokenAddress.trim();
    }

    if (!this.web3Service.web3.utils.isAddress(this.tokenAddress)) {
      this.errorMessage = 'Enter a valid contract address';
    } else {
      const tokenInDb = this.erc20Service.getToken(this.tokenAddress);
      let tokenInDB = false;
      let validToken = true;
      if (tokenInDb) {
        tokenInDB = true;
        this.errorMessage = 'Token is already in database.';
      }

      const contract = this.erc20Service.getContract(this.tokenAddress);
      const promiseList = [];

      promiseList.push(
        this.erc20Service.name(contract)
        .then(name => this.tokenName = name)
        .catch(() => validToken = false)
      );
      promiseList.push(
        this.erc20Service.symbol(contract)
        .then(symbol => this.tokenSymbol = symbol)
        .catch(() => validToken = false)
      );
      promiseList.push(
          this.erc20Service.decimals(contract)
        .then(decimals => this.tokenDecimals = decimals)
        .catch(() => validToken = false)
      );
      promiseList.push(
        this.airswapService.approvedAmountAirSwap(contract)
        .then(approvedAmount => this.tokenCanApprove = Number(approvedAmount) >= 0)
        .catch(() => validToken = false)
      );

      Promise.all(promiseList)
      .then(() => {
        this.checkedToken = true;
        this.tokenIsValid = !tokenInDB
                            && validToken
                            && this.tokenName
                            && this.tokenSymbol
                            && this.tokenDecimals >= 0
                            && this.tokenCanApprove;
        if (this.tokenIsValid) {
          this.errorMessage = '';
        } else if (!validToken) {
          this.errorMessage = 'Token is not ERC20 compatible.';
        }
      });
    }
  }

}
