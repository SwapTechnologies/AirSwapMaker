import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { AirswapService } from '../../../services/airswap.service';
import { Erc20Service } from '../../../services/erc20.service';

@Component({
  selector: 'app-ask-gas-price-approval',
  templateUrl: './ask-gas-price-approval.component.html',
  styleUrls: ['./ask-gas-price-approval.component.scss']
})
export class AskGasPriceApprovalComponent implements OnInit {

  public enteredGasPrice = 1;
  constructor(
    public dialogRef: MatDialogRef<AskGasPriceApprovalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private airswapService: AirswapService,
    private erc20Service: Erc20Service,

  ) {}

  ngOnInit() {
    this.airswapService.getGasPrice()
    .then(gasPrice => {
      this.enteredGasPrice = gasPrice / (10 ** 9);
    });
  }

  validPrice(): boolean {
    return this.enteredGasPrice > 0;
  }

  onNoClick(): void {
    this.dialogRef.close(false);
  }

  onCloseConfirm() {
    this.dialogRef.close(Math.floor(this.enteredGasPrice * 1e9));
  }

  onCloseCancel() {
    this.dialogRef.close(false);
  }
}
