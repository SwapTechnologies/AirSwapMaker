import { Component, OnInit } from '@angular/core';
import { Token } from '../../types/types';
import { AirswapService } from '../../services/airswap.service';
import { Erc20Service } from '../../services/erc20.service';
import { MatDialog } from '@angular/material';
import { AddTokenComponent } from '../../dialogs/add-token/add-token.component';

@Component({
  selector: 'app-intents',
  templateUrl: './intents.component.html',
  styleUrls: ['./intents.component.scss']
})
export class IntentsComponent implements OnInit {
  public makerToken: Token;
  public takerToken: Token;

  public markedIntents = false;
  public intentsMarkedForRemoval: any;

  public unapprovedTokens: any[] = [];

  public astBalance = 0;
  public remainingIntents: number;
  public balanceTooLow = true;

  public clickedApprove: any = {};
  public errorMessage = '';
  public showBuyButton = false;
  public initialized = false;

  public makerTokenName;
  public rawFilteredValidatedMakerTokens;
  public filteredValidatedMakerTokens;
  public takerTokenName;
  public rawFilteredValidatedTakerTokens;
  public filteredValidatedTakerTokens;

  public makerDecimals: number;
  public takerDecimals: number;

  public balanceMakerToken: number;
  public balanceTakerToken: number;

  public approveHashes = {};

  constructor(
    public airswapService: AirswapService,
    public erc20Service: Erc20Service,
    public dialog: MatDialog,
  ) { }

  ngOnInit() {
    this.filteredValidatedMakerTokens = this.erc20Service.tokenList;
    this.filteredValidatedTakerTokens = this.erc20Service.tokenList;
    this.initialize();
  }

  initialize() {
    this.getIntents();
    this.getAstBalance();
  }

  getIntents() {
    if (this.airswapService.connected && this.airswapService.isAuthenticated) {
      this.airswapService.getIntents()
      .then(() => {
        this.intentsMarkedForRemoval = [];
        for (const intent of this.airswapService.intents) {
          const makerProps = this.erc20Service.getToken(intent.makerToken.toLowerCase());
          const takerProps = this.erc20Service.getToken(intent.takerToken.toLowerCase());
          intent.makerProps = makerProps;
          intent.takerProps = takerProps;
        }
        this.checkApproval();
      });
    }
  }

  getAstBalance() {
    this.erc20Service.balance(
      this.erc20Service.getTokenByName('AirSwap Token').address,
      this.airswapService.asProtocol.wallet.address
    ).then(balance => {
      this.astBalance = balance / 1e4;
      this.balanceTooLow = this.astBalance - 250 * this.airswapService.intents.length < 250;
      this.remainingIntents = Math.floor((this.astBalance - 250 * this.airswapService.intents.length) / 250);
      this.initialized = true;
    });
  }

  enteredMakerTokenName(): void {
    this.filteredValidatedMakerTokens = this.erc20Service.tokenList.filter(x => {
      return x.name.toLowerCase().includes(this.makerTokenName.toLowerCase())
      || x.symbol.toLowerCase().includes(this.makerTokenName.toLowerCase());
    });

    const token = this.erc20Service.getTokenByName(this.makerTokenName);
    if (token) {
      this.makerToken = token;
      this.makerDecimals = 10 ** this.makerToken.decimals;
      this.getMakerTokenBalance();
    }
  }

  enteredTakerTokenName(): void {
    this.filteredValidatedTakerTokens = this.erc20Service.tokenList.filter(x => {
      return x.name.toLowerCase().includes(this.takerTokenName.toLowerCase())
      || x.symbol.toLowerCase().includes(this.takerTokenName.toLowerCase());
    });

    const token = this.erc20Service.getTokenByName(this.takerTokenName);
    if (token) {
      this.takerToken = token;
      this.takerDecimals = 10 ** this.takerToken.decimals;
      this.getTakerTokenBalance();
    }
  }

  findIdxOfIntent(intent, intentList): number {
    return intentList.findIndex(x => {
      return (x.makerToken === intent.makerToken
           && x.takerToken === intent.takerToken);
    });
  }

  isIntentInList(intent): any {
    return this.airswapService.intents.find(x => {
      return (x.makerToken === intent.makerToken
           && x.takerToken === intent.takerToken);
    });
  }

  changedList(event): void {
    this.markedIntents = event.length > 0;
  }

  addTokenPair(): void {
    if (this.makerToken
    && this.takerToken
    && this.makerToken.address !== this.takerToken.address
    && !this.balanceTooLow) {
      const intent = {
        'makerToken': this.makerToken.address.toLowerCase(),
        'takerToken': this.takerToken.address.toLowerCase(),
        'role': 'maker'
      };
      if (!this.isIntentInList(intent)) {
        this.airswapService.intents.push(intent);
        this.airswapService.setIntents(this.airswapService.intents)
        .then(() => {
          this.getIntents();
        });
      }
    }
  }

  tokenSymbol(tokenAddress: string): string {
    const token = this.erc20Service.getToken(tokenAddress.toLowerCase());
    if (token) {
      return token.symbol;
    } else {
      return null;
    }
  }

  removeMarkedIntents(): void {
    const newIntentList = JSON.parse(JSON.stringify(this.airswapService.intents));
    // removed marked intents
    for (const intent of this.intentsMarkedForRemoval) {
      const idx = this.findIdxOfIntent(intent, newIntentList);
      if (idx >= 0) {
        newIntentList.splice( idx, 1 );
      }
    }
    this.markedIntents = false;
    this.airswapService.setIntents(newIntentList)
    .then(() => {
      this.getIntents();
    });
  }

  checkApproval(): void {
    const promiseList = [];
    this.unapprovedTokens = [];
    for (const intent of this.airswapService.intents) {
      if (intent.makerToken) {
        const contract = this.erc20Service.getContract(intent.makerToken);
        this.clickedApprove[intent.makerToken] = false;
        promiseList.push(
          this.erc20Service.approvedAmountAirSwap(contract)
          .then(approvedAmount => {
            if (!(approvedAmount > 0)
            && !this.unapprovedTokens.find(x => x === intent.makerToken) ) {
              this.unapprovedTokens.push(intent.makerToken);
            }
          })
        );
      }
    }
  }

  approveMaker(makerToken: string): void {
    this.clickedApprove[makerToken] = true;
    const contract = this.erc20Service.getContract(makerToken);
    this.erc20Service.approve(makerToken)
    .then(result => {
      this.approveHashes[makerToken] = result.hash;
    })
    .catch(error => {
      console.log('Approve failed.');
      this.clickedApprove[makerToken] = false;
    });
  }

  filterEther(token: any) {
    return token.address !== '0x0000000000000000000000000000000000000000';
  }

  getMakerTokenBalance(): void {
    this.erc20Service.balance(this.makerToken.address, this.airswapService.asProtocol.wallet.address)
    .then(balance => {
      this.balanceMakerToken = balance;
    })
    .catch(error =>
      console.log('Error fetching the balance of ' + this.airswapService.asProtocol.wallet.address +
        ' for contract ' + this.makerToken.address)
    );
  }

  getTakerTokenBalance(): void {
    this.erc20Service.balance(this.takerToken.address, this.airswapService.asProtocol.wallet.address)
    .then(balance => {
      this.balanceTakerToken = balance;
    })
    .catch(error =>
      console.log('Error fetching the balance of ' + this.airswapService.asProtocol.wallet.address +
        ' for contract ' + this.takerToken.address)
    );
  }

  clearMakerTokenName(): void {
    this.makerTokenName = '';
    this.enteredMakerTokenName();
  }

  clearTakerTokenName(): void {
    this.takerTokenName = '';
    this.enteredTakerTokenName();
  }

  addToken(): void {
    const dialogRef = this.dialog.open(AddTokenComponent, {
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.filteredValidatedMakerTokens = this.erc20Service.tokenList;
        this.filteredValidatedTakerTokens = this.erc20Service.tokenList;
        this.initialize();
      }
    });
  }
}
