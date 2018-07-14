import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

@Component({
  selector: 'app-dialog-enter-private-key',
  templateUrl: './dialog-enter-private-key.component.html',
  styleUrls: ['./dialog-enter-private-key.component.scss']
})
export class DialogEnterPrivateKeyComponent implements OnInit {

  public enteredPrivateKey = '';
  constructor(
    public dialogRef: MatDialogRef<DialogEnterPrivateKeyComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) { }


  ngOnInit() {
  }

  onNoClick(): void {
    this.dialogRef.close(false);
  }

  onCloseConfirm() {
    this.dialogRef.close(this.enteredPrivateKey);
  }

  onCloseCancel() {
    this.dialogRef.close(false);
  }
}
