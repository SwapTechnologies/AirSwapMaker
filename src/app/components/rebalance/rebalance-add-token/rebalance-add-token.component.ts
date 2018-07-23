import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { AirswapService } from '../../../services/airswap.service';
import { Erc20Service } from '../../../services/erc20.service';
import { AppConfig } from '../../../../environments/environment';

@Component({
  selector: 'app-rebalance-add-token',
  templateUrl: './rebalance-add-token.component.html',
  styleUrls: ['./rebalance-add-token.component.scss']
})
export class RebalanceAddTokenComponent implements OnInit {
  public tokenName;
  public token;
  public rawFilteredValidatedTokens;
  public filteredValidatedTokens;

  constructor(
    public dialogRef: MatDialogRef<RebalanceAddTokenComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private airswapService: AirswapService,
    private erc20Service: Erc20Service
  ) { }

  ngOnInit() {
    this.filteredValidatedTokens = this.erc20Service.tokenList;
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

  filterEther(token: any) {
    return ((token.address !== AppConfig.ethAddress) && (token.address !== AppConfig.wethAddress));
  }

  enteredTokenName(): void {
    this.filteredValidatedTokens = this.erc20Service.tokenList.filter(x => {
      return x.name.toLowerCase().includes(this.tokenName.toLowerCase())
      || x.symbol.toLowerCase().includes(this.tokenName.toLowerCase());
    });

    const token = this.erc20Service.getTokenByName(this.tokenName);
    if (token) {
      this.token = token;
    }
  }

  addToken(): void {
    if (this.token !== undefined) {
      this.airswapService.addTokenToList(this.token);
      this.onCloseConfirm();
    }
  }

  clearTokenName(): void {
    this.tokenName = '';
    this.enteredTokenName();
  }
}
