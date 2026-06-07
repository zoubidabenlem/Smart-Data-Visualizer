// src/app/features/dashboards/components/widget-chart/widget-chart.component.ts
import { Component, Input, OnChanges, OnDestroy, SimpleChanges, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import Chart from 'chart.js/auto'; // or import * as Chart from 'chart.js';
import { WidgetResponse } from 'src/app/core/models/dashboard.model';

@Component({
  selector: 'app-widget-chart',
  templateUrl: './widget-chart.component.html',
  styleUrls: ['./widget-chart.component.css']
})
export class WidgetChartComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() widget!: WidgetResponse;
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private chartInstance: Chart | null = null;
  kpiValue: string | number = '';

  ngAfterViewInit(): void {
      console.log('[WidgetChart] ngAfterViewInit', this.widget);
    // Defer rendering so *ngIf creates the canvas
  setTimeout(() => {
    if (this.widget) this.renderChart();
  }, 0);
}
  

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && !changes['widget'].firstChange) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  private renderChart(): void {
      console.log('[WidgetChart] renderChart called', this.widget);

    if (!this.widget) return;
    if (this.widget.config.chart_type === 'kpi') {
      this.renderKpi();
      return;
    }
      console.log('[WidgetChart] canvasRef =', this.canvasRef?.nativeElement);

    if (!this.canvasRef?.nativeElement) return;
    const data = this.widget.chart_data;
    if (!data || data.length === 0) return;

    // Destroy previous chart instance
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    // Prepare datasets based on chart_type
    // Assumes chart_data is an array of objects with keys for labels and values
    // For simplicity, we assume first key is labels, second is values, or we deduce
    const keys = Object.keys(data[0]);
    let labelKey = keys[0];
    let valueKey = keys[1];
    // Special handling: if there's a 'category' and 'value' or similar
    if (keys.includes('category')) labelKey = 'category';
    if (keys.includes('value')) valueKey = 'value';

    const labels = data.map(row => row[labelKey]);
    const values = data.map(row => row[valueKey]);

    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const chartType = this.mapChartType(this.widget.config.chart_type);
    this.chartInstance = new Chart(ctx, {
      type: chartType,
      data: {
        labels: labels,
        datasets: [{
          label: valueKey,
          data: values,
          backgroundColor: 'rgba(108, 139, 176, 0.6)',
          borderColor: '#6c8bb0',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'top' },
          tooltip: { enabled: true }
        }
      }
    });
  }

  private renderKpi(): void {
    const data = this.widget.chart_data;
    if (data && data.length > 0) {
      // For KPI, we expect a single value or a single row with a 'value' field
      const firstRow = data[0];
      const value = firstRow['value'] ?? firstRow[Object.keys(firstRow)[0]];
      this.kpiValue = value;
    } else {
      this.kpiValue = '—';
    }
  }

  private mapChartType(type: string): any {
    switch (type) {
      case 'bar': return 'bar';
      case 'line': return 'line';
      case 'pie': return 'pie';
      case 'scatter': return 'scatter';
      case 'area': return 'line'; // area chart can be line with fill
      case 'heatmap': return 'bar'; // heatmap not native; fallback
      default: return 'bar';
    }
  }
}