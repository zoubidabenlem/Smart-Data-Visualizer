// src/app/core/services/chart-renderer.service.ts

import { Injectable } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { registerables } from 'chart.js';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';
import { WidgetResponse, WidgetConfig } from 'src/app/core/models/dashboard.model';

// Register all necessary Chart.js components (including matrix) once.
Chart.register(...registerables, MatrixController, MatrixElement);

@Injectable({
  providedIn: 'root'
})
export class ChartRendererService {

  /**
   * Main method to create a chart on the given canvas.
   */
  createChart(canvas: HTMLCanvasElement, widget: WidgetResponse): Chart | null {
    if (!canvas || !widget || !widget.chart_data || widget.chart_data.length === 0) {
      return null;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const config = widget.config;
    const data = widget.chart_data;

    const dimensionCols = this.getDimensionColumns(config);
    const measureCols   = this.getMeasureColumns(config);
    const labelCol      = this.determineLabelColumn(config, data);

    switch (config.chart_type) {
      case 'pie':
        return this.renderPieChart(ctx, config, data, labelCol, measureCols);
      case 'scatter':
        return this.renderScatterChart(ctx, config, data, labelCol, measureCols, dimensionCols);
      case 'heatmap':
        return this.renderHeatmapChart(ctx, config, data, labelCol, measureCols, dimensionCols);
      case 'kpi':
        return null;
      default:
        return this.renderMultiDatasetChart(ctx, config, data, labelCol, measureCols);
    }
  }

  destroyChart(chart: Chart | null): void {
    if (chart) chart.destroy();
  }

  resizeChart(chart: Chart | null): void {
    if (chart) {
      chart.resize();
      chart.update('none');
    }
  }

  // ─── FIX: robust KPI value lookup with numeric fallback ───
  getKpiValue(widget: WidgetResponse): string {
    const data = widget?.chart_data;
    if (!data || data.length === 0) return '—';

    const row = data[0];
    const preferred = this.getMeasureColumns(widget.config);

    // 1. Try the measure alias / column name
    let raw: any = preferred
      .map(k => row?.[k])
      .find(v => v !== null && v !== undefined);

    // 2. Fall back to the first numeric value on the row
    if (raw === null || raw === undefined) {
      raw = Object.values(row).find(v => typeof v === 'number');
    }

    // 3. Last resort: first value on the row
    if (raw === null || raw === undefined) {
      raw = Object.values(row)[0];
    }

    if (typeof raw === 'number') {
      return raw.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
    return raw === null || raw === undefined ? '—' : String(raw);
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private getDimensionColumns(config: WidgetConfig): string[] {
    return config.dimensions.map(dim => dim.column);
  }

  private getMeasureColumns(config: WidgetConfig): string[] {
    return config.measures.map(measure => measure.alias || measure.column);
  }

  private determineLabelColumn(config: WidgetConfig, data: any[]): string {
    if (!data || data.length === 0) return '';
    const firstRow = data[0];
    const dims = this.getDimensionColumns(config);
    if (dims.length > 0 && firstRow.hasOwnProperty(dims[0])) {
      return dims[0];
    }
    const keys = Object.keys(firstRow);
    const firstNonNumeric = keys.find(k => typeof firstRow[k] !== 'number');
    return firstNonNumeric || keys[0];
  }

  private renderMultiDatasetChart(
    ctx: CanvasRenderingContext2D,
    config: WidgetConfig,
    data: any[],
    labelCol: string,
    measureCols: string[]
  ): Chart {
    const labels = data.map(row => row[labelCol]);

    const ranges = measureCols.map(col => {
      const vals = data.map(row => Number(row[col])).filter(v => !isNaN(v));
      if (vals.length === 0) return 0;
      return Math.max(...vals) - Math.min(...vals);
    });
    const useDualAxis = measureCols.length >= 2 &&
      (ranges[0] > 10 * ranges[1] || ranges[1] > 10 * ranges[0]);

    const schemeName = config.color_scheme || 'default';
    const colorScheme = this.getColorScheme(schemeName);

    const datasets = measureCols.map((col, index) => {
      const color = colorScheme[index % colorScheme.length];
      const isArea = config.chart_type === 'area';
      const dataset: any = {
        label: col,
        data: data.map(row => row[col]),
        backgroundColor: isArea ? color.background.replace('0.6', '0.3') : color.background,
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

    return new Chart(ctx, {
      type: chartType,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: datasets.length > 1, position: 'top' },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const label = context.dataset.label || '';
                let value = context.parsed.y;
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
    measureCols: string[]
  ): Chart | null {
    if (measureCols.length === 0) {
      console.warn('Pie chart requires at least one measure');
      return null;
    }

    const valueCol = measureCols[0];
    const labels = data.map(row => row[labelCol]);
    const values = data.map(row => Number(row[valueCol]) || 0);

    const schemeName = config.color_scheme || 'default';
    const colorScheme = this.getColorScheme(schemeName);

    const backgroundColors = labels.map((_, i) => colorScheme[i % colorScheme.length].background);
    const borderColors = labels.map((_, i) => colorScheme[i % colorScheme.length].border);

    return new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const label = context.label || '';
                const value = context.parsed;
                if (typeof value === 'number') {
                  return `${label}: ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
                }
                return `${label}: ${value}`;
              }
            }
          }
        }
      }
    });
  }

  private renderScatterChart(
    ctx: CanvasRenderingContext2D,
    config: WidgetConfig,
    data: any[],
    labelCol: string,
    measureCols: string[],
    dimensionCols: string[]
  ): Chart | null {
    let xCol: string;
    let isXCategory = false;
    if (dimensionCols.length > 0) {
      xCol = dimensionCols[0];
      isXCategory = typeof data[0][xCol] !== 'number';
    } else if (measureCols.length > 0) {
      xCol = measureCols[0];
    } else {
      console.warn('Scatter chart requires at least one dimension or measure');
      return null;
    }

    let yCol: string;
    if (measureCols.length >= 2) {
      yCol = measureCols[1];
    } else if (measureCols.length === 1) {
      yCol = measureCols[0];
    } else {
      console.warn('Scatter chart requires at least one measure');
      return null;
    }

    let seriesCol: string | null = null;
    if (dimensionCols.length > 1) {
      seriesCol = dimensionCols[1];
    }

    const schemeName = config.color_scheme || 'default';
    const colorScheme = this.getColorScheme(schemeName);

    const toPoint = (row: any): { x: number; y: number } => {
      let x: number;
      if (isXCategory) {
        const categories = Array.from(new Set(data.map(r => String(r[xCol]))));
        const baseIndex = categories.indexOf(String(row[xCol]));
        const jitter = (Math.random() - 0.5) * 0.5;
        x = baseIndex + jitter;
      } else {
        x = Number(row[xCol]);
      }
      return { x, y: Number(row[yCol]) };
    };

    let datasets: any[];

    if (seriesCol && data[0]?.hasOwnProperty(seriesCol)) {
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
          pointHoverRadius: 6,
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

    const xCategories = isXCategory
      ? Array.from(new Set(data.map(r => String(r[xCol]))))
      : [];

    return new Chart(ctx, {
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
                  xDisplay = xCategories[nearestIndex] ?? String(p.x);
                } else {
                  xDisplay = String(p.x);
                }
                return `${context.dataset.label}: (${xDisplay}, ${p.y})`;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: xCol },
            min: isXCategory ? -0.5 : undefined,
            max: isXCategory ? xCategories.length - 0.5 : undefined,
            ticks: {
              autoSkip: false,
              maxRotation: 45,
              callback: (value: any) => {
                if (isXCategory && Number.isInteger(value)) {
                  return xCategories[value] ?? '';
                }
                return value;
              }
            }
          },
          y: {
            type: 'linear',
            title: { display: true, text: yCol },
            ticks: {
              callback: (value) => Number(value).toLocaleString()
            }
          }
        }
      }
    });
  }

  private renderHeatmapChart(
    ctx: CanvasRenderingContext2D,
    config: WidgetConfig,
    data: any[],
    labelCol: string,
    measureCols: string[],
    dimensionCols: string[]
  ): Chart | null {
    if (dimensionCols.length < 2) {
      console.warn('Heatmap requires at least two dimensions');
      return this.renderMultiDatasetChart(ctx, config, data, labelCol, measureCols);
    }

    const xCol = dimensionCols[0];
    const yCol = dimensionCols[1];
    const valueCol = measureCols[0];
    if (!valueCol || !data[0]?.hasOwnProperty(valueCol)) {
      console.warn('Heatmap requires a valid measure column');
      return this.renderMultiDatasetChart(ctx, config, data, labelCol, measureCols);
    }

    const xCategories = Array.from(new Set(data.map(r => String(r[xCol]))));
    const yCategories = Array.from(new Set(data.map(r => String(r[yCol]))));

    const matrixData = data.map(row => ({
      x: xCategories.indexOf(String(row[xCol])),
      y: yCategories.indexOf(String(row[yCol])),
      v: Number(row[valueCol]) || 0
    }));

    if (matrixData.length === 0) {
      return this.renderMultiDatasetChart(ctx, config, data, labelCol, measureCols);
    }

    const schemeName = config.color_scheme || 'default';
    const colorScheme = this.getColorScheme(schemeName);
    const baseColor = colorScheme[0].border;

    const hexToRgb = (hex: string) => ({
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    });
    const base = hexToRgb(baseColor);
    const light = { r: 240, g: 240, b: 240 };

    const lerpColor = (c1: any, c2: any, t: number) => ({
      r: Math.round(c1.r + (c2.r - c1.r) * t),
      g: Math.round(c1.g + (c2.g - c1.g) * t),
      b: Math.round(c1.b + (c2.b - c1.b) * t)
    });

    const values = matrixData.map(d => d.v);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    return new Chart(ctx, {
      type: 'matrix',
      data: {
        datasets: [{
          label: valueCol,
          data: matrixData,
          backgroundColor(ctx: any) {
            const value = ctx.raw?.v;
            const t = (value - minVal) / range;
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
        { background: 'rgba(255, 159, 64, 0.6)', border: '#ff9f40' },
        { background: 'rgba(201, 203, 207, 0.6)', border: '#c9cbcf' },
        { background: 'rgba(233, 30, 99, 0.6)', border: '#e91e63' },
        { background: 'rgba(76, 175, 80, 0.6)', border: '#4caf50' },
        { background: 'rgba(0, 150, 136, 0.6)', border: '#009688' }
      ],
      pastel: [
        { background: 'rgba(179, 205, 224, 0.8)', border: '#b3cde0' },
        { background: 'rgba(251, 180, 174, 0.8)', border: '#fbb4ae' },
        { background: 'rgba(204, 235, 197, 0.8)', border: '#ccebc5' },
        { background: 'rgba(222, 203, 228, 0.8)', border: '#decbe4' },
        { background: 'rgba(254, 217, 166, 0.8)', border: '#fed9a6' },
        { background: 'rgba(255, 255, 204, 0.8)', border: '#ffffcc' },
        { background: 'rgba(229, 216, 189, 0.8)', border: '#e5d8bd' },
        { background: 'rgba(235, 201, 235, 0.8)', border: '#ebc9eb' },
        { background: 'rgba(204, 255, 204, 0.8)', border: '#ccffcc' },
        { background: 'rgba(217, 217, 217, 0.8)', border: '#d9d9d9' }
      ],
      dark: [
        { background: 'rgba(70, 70, 70, 0.8)', border: '#464646' },
        { background: 'rgba(200, 50, 50, 0.8)', border: '#c83232' },
        { background: 'rgba(50, 200, 50, 0.8)', border: '#32c832' },
        { background: 'rgba(50, 50, 200, 0.8)', border: '#3232c8' },
        { background: 'rgba(200, 200, 50, 0.8)', border: '#c8c832' },
        { background: 'rgba(150, 50, 150, 0.8)', border: '#963296' },
        { background: 'rgba(200, 100, 0, 0.8)', border: '#c86400' },
        { background: 'rgba(0, 150, 150, 0.8)', border: '#009696' },
        { background: 'rgba(100, 150, 50, 0.8)', border: '#649632' },
        { background: 'rgba(120, 120, 120, 0.8)', border: '#787878' }
      ]
    };

    return schemes[schemeName] || schemes['default'];
  }
}