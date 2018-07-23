import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { OptionsRebalanceComponent } from './options-rebalance.component';

describe('OptionsRebalanceComponent', () => {
  let component: OptionsRebalanceComponent;
  let fixture: ComponentFixture<OptionsRebalanceComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ OptionsRebalanceComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OptionsRebalanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
