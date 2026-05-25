import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FiltersStepComponent } from './filters-step.component';

describe('FiltersStepComponent', () => {
  let component: FiltersStepComponent;
  let fixture: ComponentFixture<FiltersStepComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [FiltersStepComponent]
    });
    fixture = TestBed.createComponent(FiltersStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
