import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

@Component({
  selector: 'app-dialog-load-keystore',
  templateUrl: './dialog-load-keystore.component.html',
  styleUrls: ['./dialog-load-keystore.component.scss']
})
export class DialogLoadKeystoreComponent implements OnInit {
  public enteredPassword = '';
  constructor(
    public dialogRef: MatDialogRef<DialogLoadKeystoreComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) { }


  ngOnInit() {
  }

  onNoClick(): void {
    this.dialogRef.close(false);
  }

  onCloseConfirm() {
    this.dialogRef.close(this.enteredPassword);
  }

  onCloseCancel() {
    this.dialogRef.close(false);
  }

}
