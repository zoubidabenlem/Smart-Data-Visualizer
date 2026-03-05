import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChartTypeSelectorComponent } from './chart-type-selector.component';

describe('ChartTypeSelectorComponent', () => {
  let component: ChartTypeSelectorComponent;
  let fixture: ComponentFixture<ChartTypeSelectorComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ChartTypeSelectorComponent]
    });
    fixture = TestBed.createComponent(ChartTypeSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
