import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WrapEthComponent } from './wrap-eth.component';

describe('WrapEthComponent', () => {
  let component: WrapEthComponent;
  let fixture: ComponentFixture<WrapEthComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ WrapEthComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WrapEthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
