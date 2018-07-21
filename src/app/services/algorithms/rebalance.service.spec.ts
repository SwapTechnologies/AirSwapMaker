import { TestBed, inject } from '@angular/core/testing';

import { RebalanceService } from './rebalance.service';

describe('RebalanceService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RebalanceService]
    });
  });

  it('should be created', inject([RebalanceService], (service: RebalanceService) => {
    expect(service).toBeTruthy();
  }));
});
