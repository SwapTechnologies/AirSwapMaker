import 'zone.js/dist/zone-mix';
import 'reflect-metadata';
import '../polyfills';

import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NgMaterialModule } from './modules/ng-material/ng-material.module';

import { HttpClientModule, HttpClient } from '@angular/common/http';

// pipes
import { RoundPipe } from './pipes/round';
import { CallbackPipe } from './pipes/callback';

// NG Translate
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { ElectronService } from './providers/electron.service';

import { WebviewDirective } from './directives/webview.directive';

import { AppComponent } from './app.component';
import { HomeComponent } from './components/home/home.component';
import { AccountComponent } from './components/account/account.component';
import { IntentsComponent } from './components/intents/intents.component';
import { PriceComponent } from './components/price/price.component';
import { LogsComponent } from './components/logs/logs.component';

import { AirswapService } from './services/airswap.service';
import { Erc20Service } from './services/erc20.service';
import { PriceService } from './services/price.service';
import { Web3Service } from './services/web3.service';

// AoT requires an exported function for factories
export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    WebviewDirective,
    AccountComponent,
    IntentsComponent,
    PriceComponent,
    LogsComponent,
    RoundPipe,
    CallbackPipe
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    AppRoutingModule,
    HttpClientModule,
    NgMaterialModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: (HttpLoaderFactory),
        deps: [HttpClient]
      }
    })
  ],
  providers: [
    ElectronService,
    AirswapService,
    Erc20Service,
    PriceService,
    Web3Service
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
