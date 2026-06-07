import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetChartComponent } from './widget-chart.component';

describe('WidgetChartComponent', () => {
  let component: WidgetChartComponent;
  let fixture: ComponentFixture<WidgetChartComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [WidgetChartComponent]
    });
    fixture = TestBed.createComponent(WidgetChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
