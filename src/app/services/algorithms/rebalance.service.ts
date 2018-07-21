import { Injectable } from '@angular/core';
import { AirswapService } from '../airswap.service';
import { PriceService } from '../price.service';
import { TimerObservable } from 'rxjs/observable/TimerObservable';

@Injectable({
  providedIn: 'root'
})
export class RebalanceService {

  public currentFractions = {};
  public currentTotalPortfolioValue: number;

  public goalBalances = {};
  public goalFractions = {};
  public goalPrices = {};

  public updateTimer: any;

  constructor(
    private airswapService: AirswapService,
    private priceService: PriceService,
  ) { }

  updateCurrentValues() {
    this.priceService.getBalancesAndPrices()
    .then(() => {
      this.currentTotalPortfolioValue = 0;
      for (const token of this.airswapService.tokenList) {
        this.currentTotalPortfolioValue +=
          this.priceService.balances[token] /
          this.airswapService.tokenProps[token].powerDecimals *
          this.priceService.usdPricesByToken[token];
      }
      for (const token of this.airswapService.tokenList) {
        this.currentFractions[token] = this.priceService.balances[token] /
        this.airswapService.tokenProps[token].powerDecimals *
        this.priceService.usdPricesByToken[token] / this.currentTotalPortfolioValue;
      }
    });
  }
}
