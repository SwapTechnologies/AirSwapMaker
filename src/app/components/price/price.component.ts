import { Component, OnInit, OnDestroy } from '@angular/core';
import { AirswapService } from '../../services/airswap.service';
import { Erc20Service } from '../../services/erc20.service';
import { PriceService } from '../../services/price.service';
import { MatDialog } from '@angular/material';
import { WrapEthComponent } from '../../dialogs/wrap-eth/wrap-eth.component';

import { TimerObservable } from 'rxjs/observable/TimerObservable';
import { AppConfig } from '../../../environments/environment';

@Component({
  selector: 'app-price',
  templateUrl: './price.component.html',
  styleUrls: ['./price.component.scss']
})
export class PriceComponent implements OnInit, OnDestroy {

  public enteredPrices = {};
  public enteredAmounts = {};

  public enteredExpiration: number;

  public amountWethSelling = 0;
  public neededWeth = 0;
  objectKeys = Object.keys;

  constructor(
    public airswapService: AirswapService,
    public erc20Service: Erc20Service,
    public priceService: PriceService,
    public dialog: MatDialog,
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
    this.calculateWethSelling();
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
      this.calculateWethSelling();
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
    this.priceService.getBalancesAndPrices();
  }

  calculateWethSelling() {
    // given a list of delta balances, calculate how much weth you need for this currently
    let amountWethSelling = 0;
    for (const token in this.priceService.balancesLimits[AppConfig.wethAddress]) {
      // ignore eth and weth
      if (token !== AppConfig.wethAddress
          && token !== AppConfig.ethAddress
          && this.priceService.balancesLimits[AppConfig.wethAddress][token]) {

        amountWethSelling += this.priceService.balancesLimits[AppConfig.wethAddress][token];
      }
    }
    this.amountWethSelling = amountWethSelling;

    const wethBalance = this.priceService.balances[AppConfig.wethAddress];
    this.neededWeth = this.amountWethSelling - wethBalance; // in wei
  }

  // addToken(): void {
  //   const dialogRef = this.dialog.open(RebalanceAddTokenComponent, {});

  //   dialogRef.afterClosed().subscribe(result => {
  //     if (result) {
  //       this.refreshBalances();
  //     }
  //   });
  // }

  wrapEth() {
    this.airswapService.getGasPrice()
    .then(gasPrice => {
      const dialogRef = this.dialog.open(WrapEthComponent, {
        data: {'proposedWrapAmount': this.neededWeth},
        width: '400px',
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          result.then(mined => {
            console.log('Ether was wrapped.');
            console.log(mined);
          });
          this.refreshBalances();
        }
      });
    });
  }

  objectKeysSortedBySymbol(object): any {
    return Object.keys(object).sort((a, b) => {
      const nameA = this.airswapService.tokenProps[a].symbol;
      const nameB = this.airswapService.tokenProps[b].symbol;
      if (nameA < nameB) {
        return -1;
      }
      if (nameA > nameB) {
        return 1;
      }
      return 0;
    });
  }
}
