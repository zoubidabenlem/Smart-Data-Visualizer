import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AggregationStepComponent } from './aggregation-step.component';

describe('AggregationStepComponent', () => {
  let component: AggregationStepComponent;
  let fixture: ComponentFixture<AggregationStepComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AggregationStepComponent]
    });
    fixture = TestBed.createComponent(AggregationStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
