import { TestBed, inject } from '@angular/core/testing';

import { Erc20Service } from './erc20.service';

describe('Erc20Service', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [Erc20Service]
    });
  });

  it('should be created', inject([Erc20Service], (service: Erc20Service) => {
    expect(service).toBeTruthy();
  }));
});
