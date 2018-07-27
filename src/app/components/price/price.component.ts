import { Component, OnInit, OnDestroy } from '@angular/core';
import { AirswapService } from '../../services/airswap.service';
import { Erc20Service } from '../../services/erc20.service';
import { PriceService } from '../../services/price.service';

import { TimerObservable } from 'rxjs/observable/TimerObservable';

@Component({
  selector: 'app-price',
  templateUrl: './price.component.html',
  styleUrls: ['./price.component.scss']
})
export class PriceComponent implements OnInit, OnDestroy {

  public enteredPrices = {};
  public enteredAmounts = {};

  public enteredExpiration: number;
  objectKeys = Object.keys;

  constructor(
    public airswapService: AirswapService,
    public erc20Service: Erc20Service,
    public priceService: PriceService,
  ) {
    this.enteredExpiration = Math.floor(this.priceService.expirationTime / 60);
  }

  ngOnInit() {
    // check if prices and amount limits are set -> show them on display
    for (const intent of this.airswapService.intents) {
      if (intent.makerProps && intent.takerProps) {
        const price = this.priceService.getPrice(intent.makerProps.address, intent.takerProps.address);
        if (price) {
          this.enteredPrices[intent.makerProps.address + intent.takerProps.address] =
            price;
        }

        const limitAmount = this.priceService.getLimitAmount(intent.makerProps.address, intent.takerProps.address);
        if (limitAmount) {
          this.enteredAmounts[intent.makerProps.address + intent.takerProps.address] =
            limitAmount / intent.makerProps.powerDecimals;
        }
      }
    }

     // always update prices when component is loaded and no algorithm running
    if (!this.priceService.algorithmRunning) {
      this.priceService.updateCountdown = 100;
      this.priceService.startContinuousPriceBalanceUpdating();
    }
  }

  ngOnDestroy() {
  }

  priceValid(price: number): boolean {
    if (!price) {
      return false;
    } else {
      return price > 0;
    }
  }

  setPrice(makerProps: any, takerProps: any, price: number) {
    if (this.priceValid(price)) {
      this.priceService.setPrice(
        makerProps.address,
        takerProps.address,
        price
      );
    }
  }

  setAmount(makerProps: any, takerProps: any, amount: number) {
    if (amount >= 0) {
      this.priceService.setLimitAmount(
        makerProps.address,
        takerProps.address,
        amount * makerProps.powerDecimals);
      this.priceService.updateLiquidity();
    }
  }

  removePrice(makerProps: any, takerProps: any) {
    this.priceService.removePriceOffer(makerProps.address, takerProps.address);
  }

  setExpiration() {
    if (this.enteredExpiration > 0) {
      this.priceService.expirationTime = Math.floor(this.enteredExpiration * 60);
    }
  }

  showOptions(makerProps: any, takerProps: any) {
    //
  }

  refreshBalances() {
    this.priceService.getBalances();
    this.priceService.getUsdPrices();
  }
}
