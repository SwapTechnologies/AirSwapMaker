import { HomeComponent } from './components/home/home.component';
import { AccountComponent } from './components/account/account.component';
import { IntentsComponent } from './components/intents/intents.component';
import { LogsComponent } from './components/logs/logs.component';
import { PriceComponent } from './components/price/price.component';
import { RebalanceComponent } from './components/rebalance/rebalance.component';

import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

const routes: Routes = [
    { path: '', component: AccountComponent },
    { path: 'account', component: AccountComponent },
    { path: 'intents', component: IntentsComponent },
    { path: 'logs', component: LogsComponent },
    { path: 'price', component: PriceComponent },
    { path: 'rebalance', component: RebalanceComponent },
    { path: '**', redirectTo: '' }
];

@NgModule({
    imports: [RouterModule.forRoot(routes,
        { enableTracing: false })],
    exports: [RouterModule]
})
export class AppRoutingModule { }
