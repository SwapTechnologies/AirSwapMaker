import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogLoadKeystoreComponent } from './dialog-load-keystore.component';

describe('DialogLoadKeystoreComponent', () => {
  let component: DialogLoadKeystoreComponent;
  let fixture: ComponentFixture<DialogLoadKeystoreComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DialogLoadKeystoreComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DialogLoadKeystoreComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
