import {
  Component, Input, OnChanges, OnDestroy, SimpleChanges,
  ElementRef, ViewChild, AfterViewInit, NgZone,
  ChangeDetectorRef
} from '@angular/core';
import  { Chart } from 'chart.js/auto';
import { WidgetResponse, WidgetConfig } from 'src/app/core/models/dashboard.model';
import {  registerables } from 'chart.js';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';

Chart.register(...registerables, MatrixController, MatrixElement);
@Component({
  selector: 'app-widget-chart',
  templateUrl: './widget-chart.component.html',
  styleUrls: ['./widget-chart.component.css']
})
export class WidgetChartComponent implements OnDestroy, AfterViewInit {
  private _widget!: WidgetResponse;

@Input() set widget(val: WidgetResponse) {
  this._widget = val;
  // only render if we have data and a non‑kpi widget (kpi doesn’t need canvas)
  if (val) {
    if (val.config.chart_type === 'kpi') {
      this.renderKpi();
    } else {
      this.tryRenderChart();
    }}
}
get widget(): WidgetResponse {
  return this._widget;
}
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private chartInstance: Chart | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private renderAttempts = 0;
  private maxAttempts = 12; // ~200ms total

  kpiValue: string | number = '';

  constructor(private ngZone: NgZone, private cdr: ChangeDetectorRef) {
    console.log('[WidgetChart] component constructed');
  }

  ngAfterViewInit(): void {
    console.log('[WidgetChart] ngAfterViewInit', {
      widget: !!this.widget,
      canvasReady: !!this.canvasRef?.nativeElement
    });

    // Setup resize observer (keep as before)
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

    // If the widget was already set, start attempting to render
    if (this.widget && this.widget.config.chart_type !== 'kpi') {
      this.tryRenderChart();
    }
  }

  

  ngOnDestroy(): void {
    this.chartInstance?.destroy();
    this.resizeObserver?.disconnect();

  }

  private tryRenderChart(): void {
    // Ready if canvas exists and data is non‑empty
    if (this.canvasRef?.nativeElement && this.widget?.chart_data?.length) {
      this.renderAttempts = 0;
      this.renderChart();
      return;
    }

    if (this.renderAttempts >= this.maxAttempts) {
      console.error('[WidgetChart] Canvas never became available');
      return;
    }

    this.renderAttempts++;
    requestAnimationFrame(() => {
      // Force Angular to update the view (especially inside gridster)
      this.cdr.detectChanges();
      this.tryRenderChart();
    });
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
  const chartType = this.mapChartType(config.chart_type);

  // ── 1. Determine label column (used by all types) ──
  const labelCol = this.determineLabelColumn(config, data);

  // ── 2. Find numeric value columns ──
  const firstRow = data[0];
  const allNumKeys = Object.keys(firstRow).filter(
    key => typeof firstRow[key] === 'number'
  );

  // ── 3. Branch by chart type ──
  if (config.chart_type === 'pie') {
    this.renderPieChart(ctx, config, data, labelCol, allNumKeys);
  } else if (config.chart_type === 'scatter') {
    this.renderScatterChart(ctx, config, data, labelCol, allNumKeys);
  } else if (config.chart_type === 'heatmap') {
    this.renderHeatmapChart(ctx, config, data, labelCol, allNumKeys);
  } else {
    // Bar, Line, Area – already working with multiple datasets and dual axis
    this.renderMultiDatasetChart(ctx, config, data, labelCol, allNumKeys);
  }
}
//jjdjkwjekdjkjdwkjkejwdkjwkdjkjdkjdkjk
private renderMultiDatasetChart(
  ctx: CanvasRenderingContext2D,
  config: WidgetConfig,
  data: any[],
  labelCol: string,
  numKeys: string[]
): void {
  const labels = data.map(row => row[labelCol]);

  // Determine if we need dual axes (already implemented)
  const ranges = numKeys.map(col => {
    const vals = data.map(row => row[col]);
    return Math.max(...vals) - Math.min(...vals);
  });
  const useDualAxis = numKeys.length >= 2 &&
    (ranges[0] > 10 * ranges[1] || ranges[1] > 10 * ranges[0]);

  const schemeName = config.color_scheme || 'default';
  const colorScheme = this.getColorScheme(schemeName);

  const datasets = numKeys.map((col, index) => {
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
  const scales: any = {};
  if (chartType !== 'pie') {
    scales.x = { display: true };
    scales.y = {
      beginAtZero: false,
      position: 'left',
      ticks: {
        callback: (v: any) => typeof v === 'number'
          ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
          : v
      }
    };
    if (useDualAxis) {
      scales.y1 = {
        beginAtZero: false,
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
private renderPieChart(
  ctx: CanvasRenderingContext2D,
  config: WidgetConfig,
  data: any[],
  labelCol: string,
  numKeys: string[]
): void {
  if (numKeys.length === 0) {
    console.warn('Pie: no numeric columns. Cannot render.');
    return;
  }

  let valueCol = numKeys[0];
  if (config.y_column && data[0]?.hasOwnProperty(config.y_column)) {
    valueCol = config.y_column;
  }

  // Guard
  if (!data[0] || !data[0].hasOwnProperty(valueCol)) {
    console.warn(`Pie: value column "${valueCol}" not found in data. Using first numeric column.`);
    valueCol = numKeys[0];
    // If still missing, bail
    if (!data[0]?.hasOwnProperty(valueCol)) {
      console.error('Pie: no valid value column found.');
      return;
    }
  }

  const labels = data.map(row => row[labelCol]);
  const values = data.map(row => Number(row[valueCol]) || 0);

  const schemeName = config.color_scheme || 'default';
  const colorScheme = this.getColorScheme(schemeName);
  // Pie uses many colours – generate one per slice
  const backgroundColors = labels.map(
    (_, i) => colorScheme[i % colorScheme.length].background
  );
  const borderColors = labels.map(
    (_, i) => colorScheme[i % colorScheme.length].border
  );

  this.chartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const label = ctx.label || '';
              const value = ctx.parsed;
              if (typeof value === 'number') {
                return `${label}: ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
              }
              return `${label}: ${value}`;
            },
          },
        },
      },
    },
  });
}
private renderScatterChart(
  ctx: CanvasRenderingContext2D,
  config: WidgetConfig,
  data: any[],
  labelCol: string,
  numKeys: string[]
): void {
  // ---------- 1. TRUE POWER BI AXIS MAPPING ----------
  // Force X-Axis to find your categorical dimension.
  // We check data[0] properties, but fall back to labelCol. WE NEVER FALLBACK TO GROUP_BY FOR X!
  let xCol: string | null | undefined = config.x_column;
  if (!xCol || !data[0]?.hasOwnProperty(xCol)) {
    xCol = labelCol; 
  }

  // ---------- 2. Determine Y Column (The Metric) ----------
  let yCol: string | null | undefined = config.y_column;
  if (!yCol || !data[0]?.hasOwnProperty(yCol)) {
    yCol = numKeys.find(k => k !== xCol);
    if (!yCol) {
      yCol = numKeys[0];
    }
  }

  if (!xCol || !yCol || !data[0]?.hasOwnProperty(xCol) || !data[0]?.hasOwnProperty(yCol)) {
    console.warn(`Scatter: invalid axes combinations. X: ${xCol}, Y: ${yCol}`);
    return;
  }

  // ---------- 3. Detect Categorical X (e.g., Education Levels) ----------
  const isXCategory = typeof data[0][xCol] !== 'number';
  const xLabels = isXCategory
    ? Array.from(new Set(data.map(row => String(row[xCol!]))))
    : [];

  // ---------- 4. Aggregated mode vs raw mode ----------
  const isAggregated = config.aggregations && config.aggregations.length > 0;

  if (isAggregated) {
    // ===================== AGGREGATED SCATTER (POWER BI CLONE) =====================
    // Extract the legend grouping column (e.g., Industry)
    const legendCol = (config.group_by && config.group_by.length > 0) ? config.group_by[0] : null;

    const schemeName = config.color_scheme || 'default';
    const colorScheme = this.getColorScheme(schemeName);

    let datasets: any[] = [];

    if (legendCol && data[0].hasOwnProperty(legendCol)) {
      // Group rows by your Legend dimension (Industry) so they span across X-axis columns (Education)
      const groups: Record<string, any[]> = {};
      
      data.forEach(row => {
        const groupKey = String(row[legendCol]);
        const xVal = isXCategory ? xLabels.indexOf(String(row[xCol!])) : Number(row[xCol!]);
        
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push({ x: xVal, y: Number(row[yCol!]) });
      });

      // Build colored series exactly like Power BI Legends
      datasets = Object.entries(groups).map(([label, points], index) => {
        const color = colorScheme[index % colorScheme.length];
        return {
          label: label, // Industry Name shows up in legend & tooltips
          data: points,  // Multiple points mapping across different Education columns
          backgroundColor: color.background,
          borderColor: color.border,
          borderWidth: 1,
          pointRadius: 6,
          pointHoverRadius: 8
        };
      });
    } else {
      // Fallback single series if no group_by layout is assigned
      const color = colorScheme[0];
      const points = data.map(row => ({
        x: isXCategory ? xLabels.indexOf(String(row[xCol!])) : Number(row[xCol!]),
        y: Number(row[yCol!])
      }));

      datasets = [{
        label: `${xCol} vs ${yCol}`,
        data: points,
        backgroundColor: color.background,
        borderColor: color.border,
        borderWidth: 1,
        pointRadius: 6
      }];
    }

    this.chartInstance = new Chart(ctx, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: datasets.length > 1, position: 'top' },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const p = context.raw;
                const xDisplay = isXCategory ? (xLabels[Math.round(p.x)] ?? p.x) : p.x;
                return `${context.dataset.label} (${xDisplay}): $${p.y.toLocaleString()}`;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear', // Using linear scale to allow custom step tracking & margins
            title: { display: true, text: xCol! },
            min: isXCategory ? -0.5 : undefined,
            max: isXCategory ? xLabels.length - 0.5 : undefined,
            ticks: {
              autoSkip: false,
              maxRotation: 45,
              stepSize: 1, // Forces custom ticks to register perfectly on integers
              callback: function(value: any) {
                if (isXCategory) {
                  return Number.isInteger(value) ? (xLabels[value] ?? '') : '';
                }
                return value;
              }
            }
          },
          y: {
            type: 'linear',
            title: { display: true, text: yCol! },
            ticks: {
              callback: (value) => `$${Number(value).toLocaleString()}`
            }
          }
        }
      }
    });
  } else {
    // ===================== RAW SCATTER (Existing Fallback) =====================
    const toPoint = (row: any) => {
      let x: number;
      if (isXCategory) {
        const baseIndex = xLabels.indexOf(String(row[xCol!]));
        const jitter = (Math.random() - 0.5) * 0.5;
        x = baseIndex + jitter;
      } else {
        x = Number(row[xCol!]);
      }
      return { x, y: Number(row[yCol!]) };
    };

    const seriesCol = (!config.aggregations || config.aggregations.length === 0)
      ? config.group_by?.[0] ?? null
      : null;

    const schemeName = config.color_scheme || 'default';
    const colorScheme = this.getColorScheme(schemeName);

    let datasets: any[];

    if (seriesCol && data[0].hasOwnProperty(seriesCol)) {
      const groups: Record<string, any[]> = {};
      data.forEach(row => {
        const key = String(row[seriesCol!]);
        if (!groups[key]) groups[key] = [];
        groups[key].push(toPoint(row));
      });

      datasets = Object.entries(groups).map(([label, points], index) => {
        const color = colorScheme[index % colorScheme.length];
        return {
          label,
          data: points,
          backgroundColor: color.background,
          borderColor: color.border,
          borderWidth: 1,
          pointRadius: 4,
        };
      });
    } else {
      const color = colorScheme[0];
      datasets = [{
        label: `${xCol} vs ${yCol}`,
        data: data.map(toPoint),
        backgroundColor: color.background,
        borderColor: color.border,
        borderWidth: 1,
        pointRadius: 4,
      }];
    }

    this.chartInstance = new Chart(ctx, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: datasets.length > 1, position: 'top' },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const p = context.raw;
                let xDisplay: string;
                if (isXCategory) {
                  const nearestIndex = Math.round(p.x);
                  xDisplay = xLabels[nearestIndex] ?? String(p.x);
                } else {
                  xDisplay = String(p.x);
                }
                return `${context.dataset.label}: (${xDisplay}, ${p.y})`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: xCol! },
            min: isXCategory ? -0.5 : undefined,
            max: isXCategory ? xLabels.length - 0.5 : undefined,
            ticks: {
              autoSkip: false,
              maxRotation: 45,
              callback: function(value: any) {
                if (isXCategory) {
                  return Number.isInteger(value) ? (xLabels[value] ?? '') : '';
                }
                return value;
              }
            },
          },
          y: {
            type: 'linear',
            title: { display: true, text: yCol! },
          },
        },
      },
    });
  }
}

private renderHeatmapChart(
  ctx: CanvasRenderingContext2D,
  config: WidgetConfig,
  data: any[],
  labelCol: string,
  numKeys: string[]
): void {
  // --- 1. Validate group columns ---
  const groupCols = config.group_by || [];
  if (groupCols.length < 2) {
    console.warn('Heatmap needs at least two group_by columns. Falling back.');
    this.renderMultiDatasetChart(ctx, config, data, labelCol, numKeys);
    return;
  }
  const xCol = groupCols[0];
  const yCol = groupCols[1];

  // --- 2. Value column ---
  let valueCol = numKeys[0];
  if (config.y_column && data[0]?.hasOwnProperty(config.y_column)) {
    valueCol = config.y_column;
  }
  if (!data[0] || !data[0].hasOwnProperty(valueCol)) {
    this.renderMultiDatasetChart(ctx, config, data, labelCol, numKeys);
    return;
  }

  // --- 3. Build grid ---
  const xCategories = Array.from(new Set(data.map(r => String(r[xCol]))));
  const yCategories = Array.from(new Set(data.map(r => String(r[yCol]))));

  const matrixData = data.map(row => ({
    x: xCategories.indexOf(String(row[xCol])),
    y: yCategories.indexOf(String(row[yCol])),
    v: Number(row[valueCol]) || 0
  }));
  if (matrixData.length === 0) {
    this.renderMultiDatasetChart(ctx, config, data, labelCol, numKeys);
    return;
  }

  // --- 4. Single‑hue gradient: light → dark using scheme’s first colour ---
  const schemeName = config.color_scheme || 'default';
  const colorScheme = this.getColorScheme(schemeName);
  const baseColor = colorScheme[0].border;   // e.g. '#36a2eb'

  // Convert hex to RGB
  const hexToRgb = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  });
  const base = hexToRgb(baseColor);

  // Prepare lightest colour (blend with white)
  const light = { r: 240, g: 240, b: 240 };   // near white
  // Darkest colour is the full base colour

  // Helper: interpolate between two RGB objects
  const lerpColor = (c1: any, c2: any, t: number) => ({
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t)
  });

  const values = matrixData.map(d => d.v);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  // --- 5. Create chart ---
  this.chartInstance = new Chart(ctx, {
    type: 'matrix',
    data: {
      datasets: [{
        label: valueCol,
        data: matrixData,
        backgroundColor(ctx: any) {
          const value = ctx.raw?.v;
          const t = (value - minVal) / range;  // 0 → 1
          const colour = lerpColor(light, base, t);
          return `rgb(${colour.r}, ${colour.g}, ${colour.b})`;
        },
        borderColor: '#fff',
        borderWidth: 1,
        width: ({ chart }) => (chart.chartArea?.width || 100) / xCategories.length,
        height: ({ chart }) => (chart.chartArea?.height || 100) / yCategories.length,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: () => '',
            label: (ctx: any) => {
              const p = ctx.raw;
              return `${xCategories[p.x]}, ${yCategories[p.y]}: ${p.v.toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          offset: true,
          min: -0.5,
          max: xCategories.length - 0.5,
          ticks: {
            stepSize: 1,
            autoSkip: false,
            maxRotation: 0,
            callback: (val: any) => xCategories[Math.round(Number(val))] || ''
          },
          grid: { display: false }
        },
        y: {
          type: 'linear',
          offset: true,
          min: -0.5,
          max: yCategories.length - 0.5,
          ticks: {
            stepSize: 1,
            autoSkip: false,
            maxRotation: 0,
            callback: (val: any) => yCategories[Math.round(Number(val))] || ''
          },
          grid: { display: false }
        }
      }
    }
  });
} 
//jhgdjjsejfgjhgfjhgjhdgjhgjhefjhwjshgdjwdjhgjhgdjhgdjhghdg
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

  // widget-chart.component.ts
public resizeChart(): void {
  if (this.chartInstance) {
    this.chartInstance.resize();
    this.chartInstance.update('none'); // optional but safe
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
      { background: 'rgba(54, 162, 235, 0.6)', border: '#36a2eb' },   // Blue
      { background: 'rgba(255, 99, 132, 0.6)', border: '#ff6384' },   // Red/Pink
      { background: 'rgba(75, 192, 192, 0.6)', border: '#4bc0c0' },   // Teal
      { background: 'rgba(255, 206, 86, 0.6)', border: '#ffce56' },   // Yellow
      { background: 'rgba(153, 102, 255, 0.6)', border: '#9966ff' },  // Purple
      { background: 'rgba(255, 159, 64, 0.6)', border: '#ff9f40' },   // Orange
      { background: 'rgba(201, 203, 207, 0.6)', border: '#c9cbcf' },  // Grey
      { background: 'rgba(233, 30, 99, 0.6)', border: '#e91e63' },    // Deep Pink
      { background: 'rgba(76, 175, 80, 0.6)', border: '#4caf50' },    // Green
      { background: 'rgba(0, 150, 136, 0.6)', border: '#009688' }     // Dark Teal
    ],
    pastel: [
      { background: 'rgba(179, 205, 224, 0.8)', border: '#b3cde0' },  // Light Blue
      { background: 'rgba(251, 180, 174, 0.8)', border: '#fbb4ae' },  // Soft Red
      { background: 'rgba(204, 235, 197, 0.8)', border: '#ccebc5' },  // Soft Green
      { background: 'rgba(222, 203, 228, 0.8)', border: '#decbe4' },  // Soft Purple
      { background: 'rgba(254, 217, 166, 0.8)', border: '#fed9a6' },  // Soft Orange
      { background: 'rgba(255, 255, 204, 0.8)', border: '#ffffcc' },  // Soft Yellow
      { background: 'rgba(229, 216, 189, 0.8)', border: '#e5d8bd' },  // Beige
      { background: 'rgba(235, 201, 235, 0.8)', border: '#ebc9eb' },  // Orchid
      { background: 'rgba(204, 255, 204, 0.8)', border: '#ccffcc' },  // Mint
      { background: 'rgba(217, 217, 217, 0.8)', border: '#d9d9d9' }   // Light Grey
    ],
    dark: [
      { background: 'rgba(70, 70, 70, 0.8)', border: '#464646' },     // Charcoal
      { background: 'rgba(200, 50, 50, 0.8)', border: '#c83232' },    // Crimson
      { background: 'rgba(50, 200, 50, 0.8)', border: '#32c832' },    // Lime Green
      { background: 'rgba(50, 50, 200, 0.8)', border: '#3232c8' },    // Royal Blue
      { background: 'rgba(200, 200, 50, 0.8)', border: '#c8c832' },   // Gold
      { background: 'rgba(150, 50, 150, 0.8)', border: '#963296' },   // Deep Purple
      { background: 'rgba(200, 100, 0, 0.8)', border: '#c86400' },    // Dark Orange
      { background: 'rgba(0, 150, 150, 0.8)', border: '#009696' },    // Dark Cyan
      { background: 'rgba(100, 150, 50, 0.8)', border: '#649632' },   // Olive
      { background: 'rgba(120, 120, 120, 0.8)', border: '#787878' }   // Medium Grey
    ]
  };

  return schemes[schemeName] || schemes['default'];
}

}
