import { TestBed, inject } from '@angular/core/testing';

import { AirswapService } from './airswap.service';

describe('AirswapService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AirswapService]
    });
  });

  it('should be created', inject([AirswapService], (service: AirswapService) => {
    expect(service).toBeTruthy();
  }));
});
