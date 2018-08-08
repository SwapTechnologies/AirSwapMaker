import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { round } from '../../../utils/math';
import { PriceService } from '../../../services/price.service';
import { RebalanceService } from '../../../services/algorithms/rebalance.service';

@Component({
  selector: 'app-options-rebalance',
  templateUrl: './options-rebalance.component.html',
  styleUrls: ['./options-rebalance.component.scss']
})
export class OptionsRebalanceComponent implements OnInit {

  public enteredExpiration: number;
  public enteredPriceModifier: number;
  public enteredRelativeChangeLimit: number;
  public enteredAverageChangeLimit: number;
  public continuousPriceChecked: boolean;

  constructor(
    public dialogRef: MatDialogRef<OptionsRebalanceComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    public priceService: PriceService,
    public rebalanceService: RebalanceService
  ) {
    this.enteredExpiration = Math.floor(this.priceService.expirationTime / 60);
    this.enteredPriceModifier = round((this.rebalanceService.priceModifier - 1) * 100, 6);
    this.enteredRelativeChangeLimit = round((this.rebalanceService.relativeChangeLimit) * 100, 6);
    this.enteredAverageChangeLimit = round((this.rebalanceService.averageChangeLimit) * 100, 6);
    this.continuousPriceChecked = this.rebalanceService.continuousUpdatePrices;
  }

  setExpiration() {
    if (this.enteredExpiration > 0) {
      this.priceService.expirationTime = Math.floor(this.enteredExpiration * 60);
    }
  }

  setPriceModifier() {
    this.rebalanceService.priceModifier = (this.enteredPriceModifier / 100) + 1;
    if (this.rebalanceService.algorithmIsRunning) {
      this.rebalanceService.updateIteration();
    }
  }

  setRelativeChangeLimit() {
    if (this.enteredRelativeChangeLimit > 0) {
      this.rebalanceService.relativeChangeLimit = (this.enteredRelativeChangeLimit / 100);
    }
  }

  setAverageChangeLimit() {
    if (this.enteredAverageChangeLimit > 0) {
      this.rebalanceService.averageChangeLimit = (this.enteredAverageChangeLimit / 100);
    }
  }

  updateContinuousPrice(event) {
    if (event) {
      this.rebalanceService.continuousUpdatePrices = event.checked;
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
