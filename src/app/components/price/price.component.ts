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
    for (const intent of this.airswapService.intents) {
      if (intent.makerProps && intent.takerProps) {
        if (this.priceService.limitPrices[intent.makerProps.address]
            && this.priceService.limitPrices[intent.makerProps.address][intent.takerProps.address]) {
          this.enteredPrices[intent.makerProps.address + intent.takerProps.address] =
            this.priceService.limitPrices[intent.makerProps.address][intent.takerProps.address]
            * 10 ** (intent.makerProps.decimals - intent.takerProps.decimals);
        }
      }
    }
    if (!this.priceService.algorithmRunning) {
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
      if (!this.priceService.limitPrices[makerProps.address]) {
        this.priceService.limitPrices[makerProps.address] = {};
      }
      this.priceService.limitPrices[makerProps.address][takerProps.address] =
        price * 10 ** (takerProps.decimals - makerProps.decimals);
      this.priceService.setPricingLogic();
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
