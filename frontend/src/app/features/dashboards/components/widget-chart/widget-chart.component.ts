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

  // Determine label and value keys
  const keys = Object.keys(data[0]);
  let labelKey = keys[0];
  let valueKey = keys[1];
  if (keys.includes('category')) labelKey = 'category';
  if (keys.includes('value')) valueKey = 'value';

  const labels = data.map(row => row[labelKey]);
  const values = data.map(row => row[valueKey]);

  const ctx = this.canvasRef.nativeElement.getContext('2d');
  if (!ctx) return;

  const chartType = this.mapChartType(this.widget.config.chart_type);
  const isArea = this.widget.config.chart_type === 'area';

  // --- Apply color scheme ---
  const schemeName = this.widget.config.color_scheme || 'default';
  const colorScheme = this.getColorScheme(schemeName);
  // Use the first color pair for single-dataset charts
  const mainColor = colorScheme[0];

  // Build the dataset with colors from the scheme
  const dataset: any = {
    label: valueKey,
    data: values,
    backgroundColor: isArea
      ? mainColor.background.replace('0.6', '0.3')  // lighter fill for area
      : mainColor.background,
    borderColor: mainColor.border,
    borderWidth: 1,
    fill: isArea
  };

  this.chartInstance = new Chart(ctx, {
    type: chartType,
    data: {
      labels: labels,
      datasets: [dataset]   // ✅ use the actual dataset variable
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              let label = ctx.dataset.label || '';
              let value = ctx.parsed.y;
              if (typeof value === 'number') {
                value = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
              }
              return `${label}: ${value}`;
            }
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: (value: any) => {
              if (typeof value === 'number') {
                return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
              }
              return value;
            }
          }
        }
      }
    }
  });
}

  private renderKpi(): void {
    const data = this.widget.chart_data;
    if (data && data.length > 0) {
      // For KPI, we expect a single value or a single row with a 'value' field
      const firstRow = data[0];
      let rawValue = firstRow['value'] ?? firstRow[Object.keys(firstRow)[0]];
    // Format number if it's numeric
    if (typeof rawValue === 'number') {
      this.kpiValue = rawValue.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
      } else {
        this.kpiValue = rawValue;
      }
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

  private getColorScheme(schemeName: string): { background: string; border: string }[] {
  const schemes: Record<string, { background: string; border: string }[]> = {
    default: [
      { background: 'rgba(54, 162, 235, 0.6)', border: '#36a2eb' },   // blue
      { background: 'rgba(255, 99, 132, 0.6)', border: '#ff6384' },   // red
      { background: 'rgba(75, 192, 192, 0.6)', border: '#4bc0c0' },   // green
      { background: 'rgba(255, 206, 86, 0.6)', border: '#ffce56' },   // yellow
      { background: 'rgba(153, 102, 255, 0.6)', border: '#9966ff' },  // purple
    ],
    pastel: [
      { background: 'rgba(179, 205, 224, 0.8)', border: '#b3cde0' },
      { background: 'rgba(251, 180, 174, 0.8)', border: '#fbb4ae' },
      { background: 'rgba(204, 235, 197, 0.8)', border: '#ccebc5' },
      { background: 'rgba(222, 203, 228, 0.8)', border: '#decbe4' },
      { background: 'rgba(254, 217, 166, 0.8)', border: '#fed9a6' },
    ],
    dark: [
      { background: 'rgba(70, 70, 70, 0.8)', border: '#464646' },
      { background: 'rgba(200, 50, 50, 0.8)', border: '#c83232' },
      { background: 'rgba(50, 200, 50, 0.8)', border: '#32c832' },
      { background: 'rgba(50, 50, 200, 0.8)', border: '#3232c8' },
      { background: 'rgba(200, 200, 50, 0.8)', border: '#c8c832' },
    ]
  };
  return schemes[schemeName] || schemes['default'];
}
}