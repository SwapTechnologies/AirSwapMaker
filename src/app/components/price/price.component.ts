import { Component, OnInit } from '@angular/core';
import { AirswapService } from '../../services/airswap.service';
import { Erc20Service } from '../../services/erc20.service';
import { PriceService } from '../../services/price.service';

@Component({
  selector: 'app-price',
  templateUrl: './price.component.html',
  styleUrls: ['./price.component.scss']
})
export class PriceComponent implements OnInit {

  public enteredPrices = {};
  public usdPrices = {};
  constructor(
    public airswapService: AirswapService,
    public erc20Service: Erc20Service,
    public priceService: PriceService,
  ) { }

  ngOnInit() {
    this.airswapService.getIntents()
    .then(() => {
      for (const intent of this.airswapService.intents) {
        const makerProps = this.erc20Service.getToken(intent.makerToken.toLowerCase());
        const takerProps = this.erc20Service.getToken(intent.takerToken.toLowerCase());
        intent.makerProps = makerProps;
        intent.takerProps = takerProps;
        if (intent.makerProps && intent.takerProps) {
          if (this.priceService.limitPrices[makerProps.address] &&
            this.priceService.limitPrices[makerProps.address][takerProps.address]) {
            this.enteredPrices[makerProps.address + takerProps.address] =
              this.priceService.limitPrices[makerProps.address][takerProps.address]
              * 10 ** (makerProps.decimals - takerProps.decimals);
          }
        }
      }
      this.getUsdPrices();
      this.priceService.setPricingLogic();
    });
  }

  getUsdPrices(): Promise<any> {
    const tokenSymbolList = [];
    for (const intent of this.airswapService.intents) {
      if (intent.makerProps && intent.takerProps) {
        if (!(tokenSymbolList.indexOf(intent.makerProps.symbol) >= 0)) {
          tokenSymbolList.push(intent.makerProps.symbol);
        }
        if (!(tokenSymbolList.indexOf(intent.takerProps.symbol) >= 0)) {
          tokenSymbolList.push(intent.takerProps.symbol);
        }
      }
    }

    return this.priceService.getPricesOfList(tokenSymbolList)
    .then((usdPrices) => {
      this.usdPrices = usdPrices;
      for (const intent of this.airswapService.intents) {
        if (intent.makerProps && intent.takerProps) {
          intent.price = this.usdPrices[intent.makerProps.symbol] / this.usdPrices[intent.takerProps.symbol];
        }
      }
    });
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


}
