import { Component, OnInit } from '@angular/core';

import { AirswapService } from '../../services/airswap.service';
@Component({
  selector: 'app-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss']
})
export class AccountComponent implements OnInit {

  public enteredPrivateKey = '';

  constructor(
    public airswapService: AirswapService,
  ) { }

  ngOnInit() {
  }

  connect() {
    this.airswapService.connect(this.enteredPrivateKey);
  }

}
