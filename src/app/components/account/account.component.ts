import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material';

import { DialogEnterPrivateKeyComponent } from './dialog-enter-private-key/dialog-enter-private-key.component';
import { DialogLoadKeystoreComponent } from './dialog-load-keystore/dialog-load-keystore.component';
import { AirswapService } from '../../services/airswap.service';
import * as fs from 'fs';
import * as ethers from 'ethers';
import { Web3Service } from '../../services/web3.service';

@Component({
  selector: 'app-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss']
})
export class AccountComponent implements OnInit {

  @ViewChild('keystoreFileInput') inputKeystore;

  public errorMessage = '';
  constructor(
    public airswapService: AirswapService,
    public web3Service: Web3Service,
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
      const dialogRef = this.dialog.open(DialogLoadKeystoreComponent);

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          const data = fs.readFileSync(keystoreFile.path, 'utf8');
          const jsonData = JSON.parse(data);
          ethers.Wallet.fromEncryptedWallet(JSON.stringify(jsonData), result)
          .then(wallet => {
            this.errorMessage = '';
            this.airswapService.connect(wallet.privateKey);
          }).catch(error => {
            this.errorMessage = 'Wallet decryption failed. Wrong password.';
          });
        }
        this.inputKeystore.nativeElement.value = '';
      });
    }
  }

  logout() {
    this.airswapService.logout();
  }

}
