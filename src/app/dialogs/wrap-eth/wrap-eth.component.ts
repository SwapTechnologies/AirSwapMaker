import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { AirswapService } from '../../services/airswap.service';
import { PriceService } from '../../services/price.service';
import { AppConfig } from '../../../environments/environment';
@Component({
  selector: 'app-wrap-eth',
  templateUrl: './wrap-eth.component.html',
  styleUrls: ['./wrap-eth.component.scss']
})
export class WrapEthComponent implements OnInit {

  public enteredWrapAmount: number;
  public gasPrice = 4e9;
  public ethAddress = AppConfig.ethAddress;
  constructor(
    public dialogRef: MatDialogRef<WrapEthComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private airswapService: AirswapService,
    public priceService: PriceService
  ) {
    this.enteredWrapAmount = data['proposedWrapAmount'] / 1e18;
  }

  ngOnInit() {
    this.airswapService.getGasPrice()
    .then(gasPrice => {
      this.gasPrice = gasPrice * 1e-9;
    });
  }

  onNoClick(): void {
    this.dialogRef.close(false);
  }

  onCloseConfirm() {
    if (this.enteredWrapAmount > 0 && this.gasPrice > 0) {
      this.dialogRef.close(
        this.airswapService.asProtocol.wrapEth(
          this.enteredWrapAmount, {gasPrice: Math.floor(this.gasPrice * 1e9)}
        )
      );
    } else {
      this.onCloseCancel();
    }
  }

  onCloseCancel() {
    this.dialogRef.close(false);
  }
}
