import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RebalanceAddTokenComponent } from './rebalance-add-token.component';

describe('RebalanceAddTokenComponent', () => {
  let component: RebalanceAddTokenComponent;
  let fixture: ComponentFixture<RebalanceAddTokenComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RebalanceAddTokenComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RebalanceAddTokenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
