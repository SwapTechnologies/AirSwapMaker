import { Component, OnInit } from '@angular/core';
import { AirswapService } from '../../services/airswap.service';
import { Erc20Service } from '../../services/erc20.service';
import { PriceService } from '../../services/price.service';
import { RebalanceService } from '../../services/algorithms/rebalance.service';
import { round } from '../../utils/math';
import { AppConfig } from '../../../environments/environment';
import { MatDialog } from '@angular/material';
import { OptionsRebalanceComponent } from './options-rebalance/options-rebalance.component';
import { RebalanceAddTokenComponent } from './rebalance-add-token/rebalance-add-token.component';
import { WrapEthComponent } from '../../dialogs/wrap-eth/wrap-eth.component';

@Component({
  selector: 'app-rebalance',
  templateUrl: './rebalance.component.html',
  styleUrls: ['./rebalance.component.scss']
})
export class RebalanceComponent implements OnInit {

  public enteredFractions = {};
  public ethAddress = AppConfig.ethAddress;
  public wethAddress = AppConfig.wethAddress;
  objectKeys = Object.keys;

  constructor(
    public airswapService: AirswapService,
    public erc20Service: Erc20Service,
    public priceService: PriceService,
    public rebalanceService: RebalanceService,
    public dialog: MatDialog,
  ) { }

  ngOnInit() {
    if (!this.priceService.algorithmRunning) {
      this.refreshBalances();
    }
    for (const token of this.airswapService.tokenList) {
      if (this.rebalanceService.goalFractions[token]) {
        this.enteredFractions[token] = this.rebalanceService.goalFractions[token] * 100;
      }
    }
  }

  setFraction(token: any) {
    // called when a fraction is set in the ui
    if (!this.rebalanceService.algorithmIsRunning && this.enteredFractions[token] >= 0 && this.enteredFractions[token] <= 100) {
      this.rebalanceService.goalFractions[token] = round(this.enteredFractions[token] / 100, 5);

      let sumSetFractions = 0;
      for (const listedToken of this.airswapService.tokenList) {
        if (this.rebalanceService.goalFractions[listedToken]) {
          sumSetFractions += this.rebalanceService.goalFractions[listedToken];
        }
      }
      if (sumSetFractions > 1) {
        const rescaleFactor =
          (1 - this.rebalanceService.goalFractions[token]) /
          (sumSetFractions - this.rebalanceService.goalFractions[token]);
        for (const setToken in this.rebalanceService.goalFractions) {
          if (setToken !== token && this.rebalanceService.goalFractions[setToken]) {
            this.rebalanceService.goalFractions[setToken] =
              round(this.rebalanceService.goalFractions[setToken] * rescaleFactor, 5);
            this.enteredFractions[setToken] = this.rebalanceService.goalFractions[setToken] * 100;
          }
        }
      }
      this.rebalanceService.updateGoalValues();
    }
  }

  removeToken(token: any) {
    this.airswapService.removeTokenFromList(token);
    if (this.enteredFractions[token]) {
      delete this.enteredFractions[token];
    }
    if (this.rebalanceService.goalFractions[token]) {
      delete this.rebalanceService.goalFractions[token];
    }
    this.refreshBalances();
  }

  filterWeth(token: any) {
    return token !== AppConfig.wethAddress;
  }


  scaleToOne(): void {

    // first check the sums of all set fractions
    // and also sum up the not set ones using the current fractions
    let sumSetFractions = 0;
    let sumUnsetFractions = 0;
    for (const token of this.airswapService.tokenList) {
      if (this.rebalanceService.goalFractions[token]) {
        sumSetFractions += this.rebalanceService.goalFractions[token];
      } else if (this.rebalanceService.currentFractions[token]) {
        sumUnsetFractions += this.rebalanceService.currentFractions[token];
      }
    }
    // if there are not set fractions, scale the current fractions
    // proportionally such that all adds up to 1 in the end and set them accordingly
    if (sumUnsetFractions > 0) {
      const rescaleFactor = (1 - sumSetFractions) / sumUnsetFractions;
      for (const token of this.airswapService.tokenList) {
        if (!(this.rebalanceService.goalFractions[token])
            && this.rebalanceService.currentFractions[token] !== undefined) {
          this.rebalanceService.goalFractions[token] =
            round(this.rebalanceService.currentFractions[token] * rescaleFactor, 5);
          this.enteredFractions[token] = this.rebalanceService.goalFractions[token] * 100;
        }
      }
    }

    // check if all fractions sum to 1 and if not, make it so
    let sumAllFractions = 0;
    for (const token in this.rebalanceService.goalFractions) {
      if (this.rebalanceService.goalFractions[token]) {
        sumAllFractions += this.rebalanceService.goalFractions[token];
      }
    }
    if (sumAllFractions !== 1) {
      for (const token in this.rebalanceService.goalFractions) {
        if (this.rebalanceService.goalFractions[token]) {
          this.rebalanceService.goalFractions[token] =
            round(this.rebalanceService.goalFractions[token] / sumAllFractions, 5);
          this.enteredFractions[token] = this.rebalanceService.goalFractions[token] * 100;
        }
      }
    }
    this.rebalanceService.updateGoalValues();
  }

  startAlgorithm(): void {
    this.scaleToOne();

    this.rebalanceService.startAlgorithm();
  }

  stopAlgorithm(): void {
    this.rebalanceService.stopAlgorithm();
  }

  refreshBalances(): void {
    this.rebalanceService.updateCountdown = 0;
    this.rebalanceService.updateCurrentValues()
    .then(() => {
      this.rebalanceService.updateGoalValues();
    });
  }

  openOptions(): void {
    const dialogRef = this.dialog.open(OptionsRebalanceComponent, {
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // what do?
      }
    });
  }

  addToken(): void {
    const dialogRef = this.dialog.open(RebalanceAddTokenComponent, {});

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.refreshBalances();
      }
    });
  }

  wrapEth(): void {
    this.airswapService.getGasPrice()
    .then(gasPrice => {
      const dialogRef = this.dialog.open(WrapEthComponent, {
        data: {'proposedWrapAmount': this.rebalanceService.neededWeth},
        width: '400px',
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.refreshBalances();
        }
      });
    });
  }
}
