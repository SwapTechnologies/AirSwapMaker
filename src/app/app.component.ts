import { Component, HostListener } from '@angular/core';
import { ElectronService } from './providers/electron.service';
import { TranslateService } from '@ngx-translate/core';
import { AppConfig } from '../environments/environment';

import { AirswapService } from './services/airswap.service';
import { Erc20Service } from './services/erc20.service';
import { LogsService } from './services/logs.service';
import { PriceService } from './services/price.service';
import { Web3Service } from './services/web3.service';

import { RebalanceService } from './services/algorithms/rebalance.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  @HostListener('window:beforeunload') exitApp() {
    if (this.airswapService.connected) {
      this.airswapService.storeIntentsToLocalFile();
      this.airswapService.setIntents([]);
    }
  }

  constructor(
    public electronService: ElectronService,
    private translate: TranslateService,
    public airswapService: AirswapService,
    private erc20Service: Erc20Service,
    private logsService: LogsService,
    private priceService: PriceService,
    private web3Service: Web3Service,
    private rebalanceService: RebalanceService
  ) {

    translate.setDefaultLang('en');
    // console.log('AppConfig', AppConfig);
    console.log('Welcome to AirSwap Maker.');
    if (electronService.isElectron()) {
      console.log('You are running an Electron App.');
      // console.log('Electron ipcRenderer', electronService.ipcRenderer);
      // console.log('NodeJS childProcess', electronService.childProcess);
    } else {
      console.log('You are running in Web mode.');
    }

    this.airswapService.loadIntentsFromLocalFile(); // load local file of intents (still have to set them after log in to specific account)
  }
}
