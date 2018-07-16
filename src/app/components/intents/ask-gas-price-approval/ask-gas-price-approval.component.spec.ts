import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AskGasPriceApprovalComponent } from './ask-gas-price-approval.component';

describe('AskGasPriceApprovalComponent', () => {
  let component: AskGasPriceApprovalComponent;
  let fixture: ComponentFixture<AskGasPriceApprovalComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AskGasPriceApprovalComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AskGasPriceApprovalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
