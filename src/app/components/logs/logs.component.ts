import { Component, OnInit } from '@angular/core';

import { LogsService } from '../../services/logs.service';
@Component({
  selector: 'app-logs',
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.scss']
})
export class LogsComponent implements OnInit {

  constructor(
    public logsService: LogsService,
  ) { }

  ngOnInit() {
  }

}
