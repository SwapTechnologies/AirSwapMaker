import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material';
import { Router } from '@angular/router';
import { LogsService } from './logs.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  constructor(
    private snackBar: MatSnackBar,
    private router: Router,
    private logsService: LogsService

  ) { }

  showMessage(message: string, buttonText?: string): any {
    if (!buttonText) {
      buttonText = 'OK';
    }
    this.logsService.addLog(message);
    return this.snackBar.open(message, buttonText, {
      duration: 10000,
      horizontalPosition: 'right',
      verticalPosition: 'bottom'
    });
  }

  showMessageAndRoute(message: string, route: string): void {
    const snackRef = this.showMessage(message, 'GO TO');
    snackRef.onAction().subscribe(() => {
      this.router.navigate([route]);
    });

  }

}
