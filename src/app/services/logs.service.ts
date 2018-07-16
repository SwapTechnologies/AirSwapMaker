import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LogsService {

  public logs = [];
  constructor() { }

  addLog(message: string) {
    this.logs.push({
      time: Date.now(),
      message: message
    });
  }
}
