import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChartTypeStepComponent } from './chart-type-step.component';

describe('ChartTypeStepComponent', () => {
  let component: ChartTypeStepComponent;
  let fixture: ComponentFixture<ChartTypeStepComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ChartTypeStepComponent]
    });
    fixture = TestBed.createComponent(ChartTypeStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
