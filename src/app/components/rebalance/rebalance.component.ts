import { Component, OnInit } from '@angular/core';
import { AirswapService } from '../../services/airswap.service';
import { Erc20Service } from '../../services/erc20.service';
import { PriceService } from '../../services/price.service';
import { RebalanceService } from '../../services/algorithms/rebalance.service';

@Component({
  selector: 'app-rebalance',
  templateUrl: './rebalance.component.html',
  styleUrls: ['./rebalance.component.scss']
})
export class RebalanceComponent implements OnInit {

  public enteredFractions = {};
  public enteredExpiration: number;
  objectKeys = Object.keys;

  constructor(
    public airswapService: AirswapService,
    public erc20Service: Erc20Service,
    public priceService: PriceService,
    public rebalanceService: RebalanceService,
  ) {
    this.enteredExpiration = Math.floor(this.priceService.expirationTime / 60);
  }

  ngOnInit() {
    this.rebalanceService.updateCurrentValues();
    for (const token of this.airswapService.tokenList) {
      if (this.rebalanceService.goalFractions[token]) {
        this.enteredFractions[token] = this.rebalanceService.goalFractions[token];
      }
    }
  }

  setExpiration() {
    if (this.enteredExpiration > 0) {
      this.priceService.expirationTime = Math.floor(this.enteredExpiration * 60);
    }
  }

  setFraction(token: any) {
    if (this.enteredFractions[token] >= 0 && this.enteredFractions[token] <= 100) {
      this.rebalanceService.goalFractions[token] = this.enteredFractions[token] / 100;

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
          if (this.rebalanceService.goalFractions[setToken]) {
            this.rebalanceService.goalFractions[setToken] *= rescaleFactor;
          }
        }
      }

    }
  }

  removeFraction(token: any) {
    if (this.rebalanceService.goalFractions[token]) {
      delete this.rebalanceService.goalFractions[token];
    }
    if (this.enteredFractions[token]) {
      delete this.enteredFractions[token];
    }
  }

}
