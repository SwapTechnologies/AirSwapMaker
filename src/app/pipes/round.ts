import {Pipe} from '@angular/core';

@Pipe({name: 'round'})
export class RoundPipe {
  transform(value: number, digits: number): number {
    return Math.round(value*10**digits) / 10**digits;
  }
}