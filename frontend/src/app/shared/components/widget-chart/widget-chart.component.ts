// src/app/shared/components/widget-chart/widget-chart.component.ts
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Chart } from 'chart.js/auto';

import { WidgetResponse } from 'src/app/core/models/dashboard.model';
import { ChartRendererService } from 'src/app/core/services/chart-renderer.service';

@Component({
  standalone: true,
  imports: [CommonModule, MatIconModule],
  selector: 'app-widget-chart',
  templateUrl: './widget-chart.component.html',
  styleUrls: ['./widget-chart.component.css'],
})
export class WidgetChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  private _widget: WidgetResponse | null = null;
  private chartInstance: Chart | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private viewReady = false;
  private renderScheduled = false;

  kpiValue = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private chartRenderer: ChartRendererService
  ) {}

  @Input()
  set widget(val: WidgetResponse | null) {
    const prev = this._widget;
    this._widget = val;

    if (val?.config?.chart_type === 'kpi') {
      this.kpiValue = this.chartRenderer.getKpiValue(val);
    }

    // Config identity changed? Re-render (covers chart_type switch).
    const chartChanged =
      prev?.config?.chart_type !== val?.config?.chart_type;
    const dataChanged =
      prev?.chart_data !== val?.chart_data;
    const configDirty =
      JSON.stringify(prev?.config) !== JSON.stringify(val?.config);

    if (chartChanged || dataChanged || configDirty) {
      this.scheduleRender();
    }
  }
  get widget(): WidgetResponse | null {
    return this._widget;
  }

  get hasData(): boolean {
    return (this._widget?.chart_data?.length ?? 0) > 0;
  }

   private resizeRaf = 0;

  ngAfterViewInit(): void {
    this.viewReady = true;

    const host = this.canvasRef?.nativeElement?.parentElement ?? null;
    if (host && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
      this.resizeObserver.observe(host);
    }

    this.scheduleRender();
  }

  private scheduleResize(): void {
    if (this.resizeRaf) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = 0;
      this.chartRenderer.resizeChart(this.chartInstance);
    });
  }

    ngOnDestroy(): void {
    if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
    this.chartRenderer.destroyChart(this.chartInstance);
    this.chartInstance = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }
  // ─── Render pipeline ───

  private scheduleRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;

    // Wait one frame so *ngIf / view switch has settled.
    requestAnimationFrame(() => {
      this.renderScheduled = false;
      this.cdr.detectChanges();

      // Canvas may not exist yet on chart-type switch; try again next frame.
      if (!this.canvasRef?.nativeElement) {
        if (this.viewReady && this._widget?.config?.chart_type !== 'kpi') {
          requestAnimationFrame(() => this.scheduleRender());
        }
        return;
      }

      this.renderNow();
    });
  }

  private renderNow(): void {
    this.chartRenderer.destroyChart(this.chartInstance);
    this.chartInstance = null;

    if (!this._widget || this._widget.config.chart_type === 'kpi') return;
    if (!this.canvasRef?.nativeElement) return;
    if (!this.hasData) return;

    this.chartInstance = this.chartRenderer.createChart(
      this.canvasRef.nativeElement,
      this._widget
    );
  }
}