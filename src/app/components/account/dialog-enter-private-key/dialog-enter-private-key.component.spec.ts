import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogEnterPrivateKeyComponent } from './dialog-enter-private-key.component';

describe('DialogEnterPrivateKeyComponent', () => {
  let component: DialogEnterPrivateKeyComponent;
  let fixture: ComponentFixture<DialogEnterPrivateKeyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DialogEnterPrivateKeyComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DialogEnterPrivateKeyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
