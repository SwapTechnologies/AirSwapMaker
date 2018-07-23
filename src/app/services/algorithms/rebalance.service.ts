import { Injectable } from '@angular/core';
import { AirswapService } from '../airswap.service';
import { PriceService } from '../price.service';
import { TimerObservable } from 'rxjs/observable/TimerObservable';
import { AppConfig } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RebalanceService {

  public currentFractions = {};
  public currentTotalPortfolioValue = 0;

  public goalBalances = {};
  public goalFractions = {};
  public goalPrices = {};

  public deltaBalances = {};

  public updateTimer: any;

  public PRECISION_TOLERANCE = 0.001;

  public setTokenList = [];
  public setTokenProps = {};

  public algorithmIsRunning = false;

  public neededWeth: number;

  public neededIntents: number;
  public enoughIntents: boolean;
  public missingAst: number;


  constructor(
    private airswapService: AirswapService,
    private priceService: PriceService,
  ) { }

  updateCurrentValues(): Promise<any> {
    return this.priceService.getBalancesAndPrices()
    .then(() => {
      let currentTotalPortfolioValue = 0;
      for (const token of this.airswapService.tokenList) {
        currentTotalPortfolioValue +=
          this.priceService.balances[token] /
          this.airswapService.tokenProps[token].powerDecimals *
          this.priceService.usdPricesByToken[token];
      }
      this.currentTotalPortfolioValue = currentTotalPortfolioValue;


      const currentFractions = {};
      currentFractions[AppConfig.ethAddress] = 0; // initialize always the eth fraction
      for (const token of this.airswapService.tokenList) {
        currentFractions[token] = this.priceService.balances[token] /
        this.airswapService.tokenProps[token].powerDecimals *
        this.priceService.usdPricesByToken[token] / this.currentTotalPortfolioValue;
      }

      // count weth fraction additional to eth fraction
      if (currentFractions[AppConfig.wethAddress] !== undefined) {
        currentFractions[AppConfig.ethAddress] += currentFractions[AppConfig.wethAddress];
        delete currentFractions[AppConfig.wethAddress];
      }
      this.currentFractions = currentFractions;
    });
  }

  updateGoalValues(): Promise<any> {
    const goalBalances = {};
    const deltaBalances = {};
    for (const token of this.airswapService.tokenList) {
      if (token === AppConfig.wethAddress) {
        continue; // weth is included in eth
      }
      if (this.goalFractions[token] !== undefined
          && this.priceService.usdPricesByToken[token]) {
        goalBalances[token] =
          this.currentTotalPortfolioValue * this.goalFractions[token] /
          this.priceService.usdPricesByToken[token] *
          this.airswapService.tokenProps[token].powerDecimals;

        deltaBalances[token] = goalBalances[token] - this.priceService.balances[token];
      }
    }
    this.goalBalances = goalBalances;
    this.deltaBalances = deltaBalances;
    this.calculateNeededWeth();
    return this.calculateNeededIntents();
  }

  calculateNeededWeth() {
    let neededWeth = 0;
    for (const token of this.airswapService.tokenList) {
      if (token !== AppConfig.wethAddress
          && token !== AppConfig.ethAddress
          && this.deltaBalances[token]
          && this.deltaBalances[token] > 0) {

        // buy token for weth
        neededWeth += this.deltaBalances[token]
          / this.airswapService.tokenProps[token].powerDecimals
          * this.priceService.usdPricesByToken[token]
          / this.priceService.usdPricesByToken[AppConfig.ethAddress];
      }
    }
    const wethBalance = this.priceService.balances[AppConfig.wethAddress];
    this.neededWeth = neededWeth * 1e18 - wethBalance; // in wei
  }

  calculateNeededIntents(): Promise<any> {
    let neededIntents = 0;
    for (const token of this.airswapService.tokenList) {
      if (token !== AppConfig.wethAddress
          && token !== AppConfig.ethAddress
          && this.deltaBalances[token]
          && this.deltaBalances[token] !== 0) {
        neededIntents += 1;
      }
    }
    this.neededIntents = neededIntents;
    return this.airswapService.determineAstBalanceAndRemainingIntents()
    .then(() => {
      const diffAstIntents = this.airswapService.astBalance - 250 * this.neededIntents;
      if (diffAstIntents < 0) {
        this.enoughIntents = false;
        this.missingAst = Math.floor(-diffAstIntents);
      } else {
        this.enoughIntents = true;
      }
    });
  }

  stopAlgorithm() {
    this.priceService.stopAlgorithm();
    this.algorithmIsRunning = false;
  }

  updateIteration() {
    // method that is called as refresher for the algorithm

    // update current $ prices, balances, calculate portfolio value and current fractions
    this.updateCurrentValues()
    .then(() => {
      // determine the goal balances and deltas with the given goal fractions
      return this.updateGoalValues();
    }).then(() => {
      // check if the algorithm can still run without problems
      if (!this.enoughIntents) {
        this.stopAlgorithm();
      }
    });

    // refresh internally the limit prices to achieve goal distribution
    // update the prices according to the current prices
  }

  startAlgorithm() {
    // check if everything is set for the start
    let sumFractions = 0;
    for (const token of this.airswapService.tokenList) {
      if (this.goalFractions[token]) {
        sumFractions += this.goalFractions[token];
      }
    }
    if ((Math.abs(sumFractions - 1) > this.PRECISION_TOLERANCE)) {
      throw new Error('Sum of goal fractions is off from desired precision. ' + Math.abs(sumFractions - 1));
    }
    this.updateCurrentValues()
    .then(() => {
      this.updateGoalValues();
      // setIntents according to the delta settings
      const intentList = [];

      for (const token of this.airswapService.tokenList) {
        if (token !== AppConfig.wethAddress
            && token !== AppConfig.ethAddress
            && this.deltaBalances[token]) {
          if (this.deltaBalances[token] > 0) {
            // buy token for weth
            intentList.push({
              'makerToken': AppConfig.wethAddress,
              'takerToken': token.toLowerCase(),
              'role': 'maker'
            });
          } else if (this.deltaBalances[token] < 0) {
            // sell token for eth
            intentList.push({
              'makerToken': token.toLowerCase(),
              'takerToken': AppConfig.ethAddress,
              'role': 'maker'
            });
          }
        }
      }
      // set intents accordingly
      this.airswapService.setIntents(intentList)
      .then(() => {
        // resync with get intents
        return this.airswapService.getIntents();
      }).then(() => {
        // store a deep copy of the initially set tokens for the run of the algorithm
        // so they can be changed while not losing their information

        // stop the price updating timer and avoid users interferring into the algorithm flow
        // by blocking manual setIntent and manual setPrices
        this.priceService.startAlgorithm();
        this.algorithmIsRunning = true;
        this.updateTimer = TimerObservable.create(0, 30000)
        .subscribe( () => {
          this.updateIteration();
        });
      });
    });
  }
}
