import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ChartType } from '../../../core/models/dashboard.model';

@Component({
  selector: 'app-chart-type-step',
  templateUrl: './chart-type-step.component.html',
  styleUrls: ['./chart-type-step.component.css']
})
export class ChartTypeStepComponent implements OnChanges {
  @Input() form!: FormGroup;
  @Input() columns: { name: string; type: string }[] = [];

  chartTypes: ChartType[] = ['bar', 'line', 'pie', 'scatter', 'area', 'heatmap', 'kpi'];
  needsAxes = false;
  private chartTypeSub: any;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['form'] && this.form) {
      // Clean up previous subscription to avoid memory leaks
      if (this.chartTypeSub) this.chartTypeSub.unsubscribe();
      this.chartTypeSub = this.form.get('chart_type')?.valueChanges.subscribe(() => {
        this.updateNeedsAxes();
        // Reset axes values when chart type changes (the state service will also clear on subscription)
      });
      this.updateNeedsAxes();
    }
  }

  private updateNeedsAxes(): void {
    const chart = this.form.get('chart_type')?.value;
    // Use the same logic as in state service – we could also call state.chartNeedsAxes()
    this.needsAxes = chart ? !['pie', 'kpi'].includes(chart) : false;
  }
}