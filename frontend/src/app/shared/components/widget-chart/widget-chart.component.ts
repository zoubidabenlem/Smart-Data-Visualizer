// src/app/shared/components/widget-chart/widget-chart.component.ts

import {
  Component, Input, OnDestroy, AfterViewInit,
  ElementRef, ViewChild, NgZone, ChangeDetectorRef
} from '@angular/core';
import { WidgetResponse } from 'src/app/core/models/dashboard.model';
import { ChartRendererService } from 'src/app/core/services/chart-renderer.service';
import { Chart } from 'chart.js/auto';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';

@Component({
  standalone: true,
  imports: [
     CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TitleCasePipe
  ],
  selector: 'app-widget-chart',
  templateUrl: './widget-chart.component.html',
  styleUrls: ['./widget-chart.component.css']
})
export class WidgetChartComponent implements AfterViewInit, OnDestroy {
  private _widget!: WidgetResponse;

  @Input() set widget(val: WidgetResponse) {
    this._widget = val;
    if (val) {
      if (val.config.chart_type === 'kpi') {
        // KPI doesn't need a canvas; compute display value directly
        this.kpiValue = this.chartRenderer.getKpiValue(val);
      } else {
        // Try to render chart (will wait for canvas if not ready)
        this.tryRenderChart();
      }
    }
  }
  get widget(): WidgetResponse {
    return this._widget;
  }

  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private chartInstance: Chart | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private renderAttempts = 0;
  private maxAttempts = 12;

  kpiValue: string = '';

  constructor(
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private chartRenderer: ChartRendererService
  ) {}

  ngAfterViewInit(): void {
    // Setup resize observer
    if (this.canvasRef) {
      const container = this.canvasRef.nativeElement.parentElement;
      if (container) {
        this.resizeObserver = new ResizeObserver(() => {
          this.chartRenderer.resizeChart(this.chartInstance);
        });
        this.resizeObserver.observe(container);
      }
    }

    // If widget is already set and not KPI, try to render
    if (this.widget && this.widget.config.chart_type !== 'kpi') {
      this.tryRenderChart();
    }
  }

  ngOnDestroy(): void {
    this.chartRenderer.destroyChart(this.chartInstance);
    this.resizeObserver?.disconnect();
  }

  /**
   * Attempt to render the chart, waiting for the canvas to become available.
   */
  private tryRenderChart(): void {
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
      // Force change detection (important inside gridster)
      this.cdr.detectChanges();
      this.tryRenderChart();
    });
  }

  /**
   * Render the chart using the service.
   */
  private renderChart(): void {
    if (!this.canvasRef?.nativeElement || !this.widget) return;

    // Destroy previous chart if exists
    this.chartRenderer.destroyChart(this.chartInstance);
    this.chartInstance = null;

    // Create new chart
    this.chartInstance = this.chartRenderer.createChart(
      this.canvasRef.nativeElement,
      this.widget
    );
  }
}