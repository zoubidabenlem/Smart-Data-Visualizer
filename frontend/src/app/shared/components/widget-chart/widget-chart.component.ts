import {
  Component, Input, OnChanges, OnDestroy, SimpleChanges,
  ElementRef, ViewChild, AfterViewInit, NgZone
} from '@angular/core';
import Chart from 'chart.js/auto';
import { WidgetResponse, WidgetConfig } from 'src/app/core/models/dashboard.model';

@Component({
  selector: 'app-widget-chart',
  templateUrl: './widget-chart.component.html',
  styleUrls: ['./widget-chart.component.css']
})
export class WidgetChartComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() widget!: WidgetResponse;
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private chartInstance: Chart | null = null;
  private resizeObserver: ResizeObserver | null = null;

  kpiValue: string | number = '';

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (this.widget) this.renderChart();
    }, 0);

    if (this.canvasRef) {
      const container = this.canvasRef.nativeElement.parentElement;
      if (container) {
        this.resizeObserver = new ResizeObserver(() => {
          if (this.chartInstance) {
            this.chartInstance.resize();
          }
        });
        this.resizeObserver.observe(container);
      }
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && !changes['widget'].firstChange) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.chartInstance?.destroy();
    this.resizeObserver?.disconnect();
  }

  private renderChart(): void {
    if (!this.widget) return;
    if (this.widget.config.chart_type === 'kpi') {
      this.renderKpi();
      return;
    }

    if (!this.canvasRef?.nativeElement) return;
    const data = this.widget.chart_data;
    if (!data || data.length === 0) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const config = this.widget.config;
    const schemeName = config.color_scheme || 'default';
    const colorScheme = this.getColorScheme(schemeName);

    const labelCol = this.determineLabelColumn(config, data);
    const firstRow = data[0];
    const valueCols = Object.keys(firstRow).filter(
      key => key !== labelCol && typeof firstRow[key] === 'number'
    );
    if (valueCols.length === 0) {
      const fallback = Object.keys(firstRow).find(k => typeof firstRow[k] === 'number');
      if (fallback) valueCols.push(fallback);
    }
    if (valueCols.length === 0) return;

    const labels = data.map(row => row[labelCol]);

    // Determine if we need dual axes: if ranges differ by > 10x
    const ranges = valueCols.map(col => {
      const vals = data.map(row => row[col]);
      return Math.max(...vals) - Math.min(...vals);
    });
    const useDualAxis = valueCols.length >= 2 &&
      (ranges[0] > 10 * ranges[1] || ranges[1] > 10 * ranges[0]);

    const datasets = valueCols.map((col, index) => {
      const color = colorScheme[index % colorScheme.length];
      const isArea = config.chart_type === 'area';
      const dataset: any = {
        label: col,
        data: data.map(row => row[col]),
        backgroundColor: isArea
          ? color.background.replace('0.6', '0.3')
          : color.background,
        borderColor: color.border,
        borderWidth: 1,
        fill: isArea,
      };
      if (useDualAxis && index > 0) {
        dataset.yAxisID = 'y1';
      }
      return dataset;
    });

    const chartType = this.mapChartType(config.chart_type);

    // Build scales
    const scales: any = {};
    if (chartType !== 'pie') {
      scales.x = { display: true };
      scales.y = {
        beginAtZero: true,
        position: 'left',
        ticks: {
          callback: (v: any) => typeof v === 'number'
            ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
            : v
        }
      };
      if (useDualAxis) {
        scales.y1 = {
          beginAtZero: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            callback: (v: any) => typeof v === 'number'
              ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : v
          }
        };
      }
    }

    this.chartInstance = new Chart(ctx, {
      type: chartType,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: datasets.length > 1, position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                let label = ctx.dataset.label || '';
                let value = ctx.parsed.y;
                if (typeof value === 'number')
                  value = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
                return `${label}: ${value}`;
              }
            }
          }
        },
        scales
      }
    });
  }

  private determineLabelColumn(config: WidgetConfig, data: any[]): string {
    const firstRow = data[0];
    if (config.x_column && firstRow.hasOwnProperty(config.x_column)) {
      return config.x_column;
    }
    if (config.group_by && config.group_by.length > 0) {
      const found = config.group_by.find(col => firstRow.hasOwnProperty(col));
      if (found) return found;
    }
    const keys = Object.keys(firstRow);
    const firstNonNumeric = keys.find(k => typeof firstRow[k] !== 'number');
    return firstNonNumeric || keys[0];
  }

  private renderKpi(): void {
    const data = this.widget.chart_data;
    if (data && data.length > 0) {
      const firstRow = data[0];
      let rawValue = firstRow['value'] ?? firstRow[Object.keys(firstRow)[0]];
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
      case 'area': return 'line';
      case 'heatmap': return 'bar';
      default: return 'bar';
    }
  }

  private getColorScheme(schemeName: string): { background: string; border: string }[] {
    const schemes: Record<string, { background: string; border: string }[]> = {
      default: [
        { background: 'rgba(54, 162, 235, 0.6)', border: '#36a2eb' },
        { background: 'rgba(255, 99, 132, 0.6)', border: '#ff6384' },
        { background: 'rgba(75, 192, 192, 0.6)', border: '#4bc0c0' },
        { background: 'rgba(255, 206, 86, 0.6)', border: '#ffce56' },
        { background: 'rgba(153, 102, 255, 0.6)', border: '#9966ff' },
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