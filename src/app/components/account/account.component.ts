import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material';

import { DialogEnterPrivateKeyComponent } from './dialog-enter-private-key/dialog-enter-private-key.component';
import { DialogLoadKeystoreComponent } from './dialog-load-keystore/dialog-load-keystore.component';
import { AirswapService } from '../../services/airswap.service';
import * as fs from 'fs';
import * as ethers from 'ethers';

@Component({
  selector: 'app-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss']
})
export class AccountComponent implements OnInit {

  constructor(
    public airswapService: AirswapService,
    public dialog: MatDialog,
  ) { }

  ngOnInit() {
  }

  connect() {
  }

  enterPrivateKey() {
    const dialogRef = this.dialog.open(DialogEnterPrivateKeyComponent, {
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.airswapService.connect(result);
      }
    });
  }

  loadKeystoreFile(event: any) {
    const fileToLoadArray = event.target || event.srcElement; // for compatibility with Firefox
    const fileList: FileList = fileToLoadArray.files;
    if (fileList.length > 0) {
      const keystoreFile = fileList[0];
      const dialogRef = this.dialog.open(DialogLoadKeystoreComponent, {
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          const data = fs.readFileSync(keystoreFile.path, 'utf8');
          const jsonData = JSON.parse(data);
          ethers.Wallet.fromEncryptedWallet(JSON.stringify(jsonData), result)
          .then(wallet => {
            this.airswapService.connect(wallet.privateKey);
          });
        }
      });
    }
  }

}
