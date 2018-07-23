import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { PriceService } from '../../../services/price.service';

@Component({
  selector: 'app-options-rebalance',
  templateUrl: './options-rebalance.component.html',
  styleUrls: ['./options-rebalance.component.scss']
})
export class OptionsRebalanceComponent implements OnInit {

  public enteredExpiration: number;
  constructor(
    public dialogRef: MatDialogRef<OptionsRebalanceComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private priceService: PriceService
  ) {
    this.enteredExpiration = Math.floor(this.priceService.expirationTime / 60);
  }

  setExpiration() {
    if (this.enteredExpiration > 0) {
      this.priceService.expirationTime = Math.floor(this.enteredExpiration * 60);
    }
  }

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
}
