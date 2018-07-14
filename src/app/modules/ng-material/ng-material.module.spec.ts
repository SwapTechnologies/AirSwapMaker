import { NgMaterialModule } from './ng-material.module';

describe('NgMaterialModule', () => {
  let ngMaterialModule: NgMaterialModule;

  beforeEach(() => {
    ngMaterialModule = new NgMaterialModule();
  });

  it('should create an instance', () => {
    expect(ngMaterialModule).toBeTruthy();
  });
});
