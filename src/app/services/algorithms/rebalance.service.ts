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

  public amountWethSelling = 0;
  public neededWeth: number;

  public neededIntents: number;
  public enoughIntents: boolean;
  public missingAst: number;

  public priceModifier = 1;

  public updateCountdown = 100;

  public continuousUpdatePrices = true;

  constructor(
    private airswapService: AirswapService,
    private priceService: PriceService,
  ) { }

  updateCurrentValues(): Promise<any> {
    // check your balances, and current prices and  calculate the portfolio value
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

      // calculate the value fractions of every token
      const currentFractions = {};
      currentFractions[AppConfig.ethAddress] = 0; // initialize always the eth fraction
      for (const token in this.priceService.balances) {
        if (this.priceService.balances[token] !== undefined
            && this.airswapService.tokenProps[token]
            && this.priceService.usdPricesByToken[token]) {
          currentFractions[token] = this.priceService.balances[token] /
          this.airswapService.tokenProps[token].powerDecimals *
          this.priceService.usdPricesByToken[token] / this.currentTotalPortfolioValue;
        }
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
    // for a given set of fractions you want to achieve, calculate
    // the amounts of token you need to buy and sell
    // and store those values as goalBalances and deltaBalances (what has to change)
    for (const token in this.goalFractions) {
      if (token === AppConfig.wethAddress) {
        continue; // weth is included in currentFraction, goalBalances of eth
      }
      if (this.goalFractions[token] !== undefined
          && this.priceService.usdPricesByToken[token]
          && this.airswapService.tokenProps[token]) {
        goalBalances[token] =
          this.currentTotalPortfolioValue * this.goalFractions[token] /
          this.priceService.usdPricesByToken[token] *
          this.airswapService.tokenProps[token].powerDecimals;

        deltaBalances[token] = Math.floor(goalBalances[token] - this.priceService.balances[token]);
      }
    }
    if (this.priceService.balances[AppConfig.wethAddress] !== undefined) {
      // include weth balance in deltaBalance of eth
      // if you get more eth -> people can always send you no matter what your balance is
      // if you try to reduce eth -> you have to wrap it anyway manually
      deltaBalances[AppConfig.ethAddress] -= this.priceService.balances[AppConfig.wethAddress];
    }

    this.goalBalances = goalBalances;
    this.deltaBalances = deltaBalances;
    this.calculateNeededWeth();
    return this.calculateNeededIntents();
  }

  calculateNeededWeth() {
    // given a list of delta balances, calculate how much weth you need for this currently
    let amountWethSelling = 0;
    for (const token in this.deltaBalances) {
      // ignore eth and weth
      if (token !== AppConfig.wethAddress
          && token !== AppConfig.ethAddress
          && this.deltaBalances[token]
          && this.deltaBalances[token] > 0) {

        // buy token for weth
        amountWethSelling += this.deltaBalances[token]
          / this.airswapService.tokenProps[token].powerDecimals
          * this.priceService.usdPricesByToken[token]
          / this.priceService.usdPricesByToken[AppConfig.ethAddress];
      }
    }
    this.amountWethSelling = amountWethSelling * 1e18;

    const wethBalance = this.priceService.balances[AppConfig.wethAddress];
    this.neededWeth = this.amountWethSelling - wethBalance; // in wei
  }

  calculateNeededIntents(): Promise<any> {
    let neededIntents = 0;
    for (const token in this.deltaBalances) {
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

  getSumFractions(): number {
    let sumFractions = 0;
    for (const token in this.goalFractions) {
      if (this.goalFractions[token]) {
        sumFractions += this.goalFractions[token];
      }
    }
    return sumFractions;
  }

  sumDeviatesFromOne(): boolean {
    return Math.abs(this.getSumFractions() - 1) > this.PRECISION_TOLERANCE;
  }

  startAlgorithm() {
    // check if everything is set for the start
    const sumFractions = this.getSumFractions();
    if ((Math.abs(sumFractions - 1) > this.PRECISION_TOLERANCE)) {
      throw new Error('Sum of goal fractions is off from desired precision. ' + Math.abs(sumFractions - 1));
    }
    this.updateCurrentValues()
    .then(() => {
      this.updateGoalValues();
      // setIntents according to the delta settings
      const intentList = [];

      for (const token in this.deltaBalances) {
        if (token !== AppConfig.wethAddress
            && token !== AppConfig.ethAddress
            && this.deltaBalances[token]) {
          if (this.deltaBalances[token] > 0) {
            // buy token for weth
            intentList.push(
              this.airswapService.constructIntent(
                AppConfig.wethAddress,
                token
              )
            );
          } else if (this.deltaBalances[token] < 0) {
            // sell token for eth
            intentList.push(
              this.airswapService.constructIntent(
                token,
                AppConfig.ethAddress
              )
            );
          }
        }
      }
      // set intents accordingly
      this.airswapService.setIntents(intentList)
      .then(() => {
        // resync with get intents
        return this.airswapService.getIntents();
      }).then(() => {
        // stop the price updating timer and avoid users interferring into the algorithm flow
        // by blocking manual setIntent and manual setPrices
        this.priceService.startAlgorithm();
        this.algorithmIsRunning = true;

        this.updateCountdown = 100;
        this.updateTimer = TimerObservable.create(0, 100)
        .subscribe( () => {
          this.updateCountdown = this.updateCountdown + 100 / 30000 * 100;
          if (this.updateCountdown >= 100) {
            this.updateIteration();
          }
        });
      });
    });
  }

  updateIteration() {
    this.updateCountdown = 0;
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

      for (const intent of this.airswapService.intents) {
        if (this.continuousUpdatePrices) {
          this.priceService.setPrice(intent.makerToken, intent.takerToken, this.priceModifier * intent.price);
        }

        if (intent.takerToken === AppConfig.ethAddress
            && this.deltaBalances[intent.makerToken] < 0) {
          // selling a token for eth
          this.priceService.setLimitAmount(
            intent.makerToken,
            intent.takerToken,
            -this.deltaBalances[intent.makerToken]
          );
        } else if (intent.makerToken === AppConfig.wethAddress
                   && this.deltaBalances[intent.takerToken] > 0) {
          // you are buying a token for WETH, set the limit of the pair weth, token in terms of weth
          // also keep in mind to switch from taker decimals to maker decimals
          this.priceService.setLimitAmount(
            intent.makerToken,
            intent.takerToken,
            this.deltaBalances[intent.takerToken]
            / this.airswapService.tokenProps[intent.takerToken].powerDecimals
            * this.airswapService.tokenProps[intent.makerToken].powerDecimals
            / this.priceService.getPrice(intent.makerToken, intent.takerToken)
          );
        }
        // other intents do not lead to a limit amount
      }
      this.priceService.updateLiquidity();
    });
  }

  stopAlgorithm() {
    if (this.updateTimer) {
      this.updateTimer.unsubscribe();
      this.updateTimer = null;
    }
    this.priceService.stopAlgorithm();
    this.priceService.limitPrices = {}; // remove all pricing
    this.algorithmIsRunning = false;
    this.priceService.updateCountdown = 100;
    this.priceService.startContinuousPriceBalanceUpdating();
  }
}
