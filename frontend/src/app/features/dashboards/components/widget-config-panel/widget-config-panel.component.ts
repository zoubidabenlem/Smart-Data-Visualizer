// src/app/features/dashboards/components/widget-config-panel/widget-config-panel.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { DashboardEditorService } from '../../services/dashboard-editor.service';
import { DashboardService } from 'src/app/core/services/dashboard.service';
import {
  WidgetConfig,
  WidgetResponse,
  ChartType,
  ColumnRef,
  MeasureSpec,
  Aggregation,
} from 'src/app/core/models/dashboard.model';

interface DatasetInfo {
  id: number;
  name: string;
  columns: { name: string; type: string }[];
}

interface ChartTypeOption {
  value: ChartType;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-widget-config-panel',
  standalone: false,
  templateUrl: './widget-config-panel.component.html',
  styleUrls: ['./widget-config-panel.component.css'],
})
export class WidgetConfigPanelComponent implements OnInit, OnDestroy {
  configForm: FormGroup;

  chartTypes: ChartTypeOption[] = [
    { value: 'bar',     label: 'Bar',     icon: 'bar_chart' },
    { value: 'line',    label: 'Line',    icon: 'show_chart' },
    { value: 'area',    label: 'Area',    icon: 'area_chart' },
    { value: 'pie',     label: 'Pie',     icon: 'pie_chart' },
    { value: 'scatter', label: 'Scatter', icon: 'scatter_plot' },
    { value: 'heatmap', label: 'Heatmap', icon: 'grid_on' },
    { value: 'kpi',     label: 'KPI',     icon: 'speed' },
  ];
  colorSchemes = ['default', 'pastel', 'dark'];

  datasets: DatasetInfo[] = [];
  selectedWidget: WidgetResponse | null = null;
  currentWidgetId: number | null = null;

  validationErrors: string[] = [];
  isPreviewLoading = false;
  isSaving = false;

  private subs = new Subscription();
  private isInternalChange = false;
  private lastPreviewedSignature = '';
  private lastPersistedSignature = '';

  constructor(
    private fb: FormBuilder,
    public editorService: DashboardEditorService,
    private dashboardService: DashboardService
  ) {
    this.configForm = this.fb.group({
      title: ['', Validators.required],
      chart_type: ['bar' as ChartType, Validators.required],
      color_scheme: ['default'],
      dimensions: this.fb.array([]),
      measures: this.fb.array([]),
    });
  }

  // ─────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Datasets (set by editor when a model loads)
    this.subs.add(
      this.editorService.datasets$.subscribe((raw) => {
        this.datasets = this.mapDatasets(raw);
      })
    );

    // Currently selected widget — repopulate only when its id changes.
    this.subs.add(
      this.editorService.selectedWidget$.subscribe((widget) => {
        const newId = widget?.id ?? null;
        const idChanged = newId !== this.currentWidgetId;

        this.selectedWidget = widget;
        this.currentWidgetId = newId;

        if (!idChanged) return;

        this.validationErrors = [];
        this.lastPreviewedSignature = '';
        this.lastPersistedSignature = widget ? this.signatureOf(widget.config) : '';

        if (widget) this.populateForm(widget.config);
        else this.resetForm();
      })
    );

    // Debounced form changes → preview.
    this.subs.add(
      this.configForm.valueChanges.pipe(debounceTime(300)).subscribe(() => {
        if (this.isInternalChange) return;
        this.updateDraftConfig();
      })
    );

    // Chart-type change → adjust dims/measures for KPI.
    this.subs.add(
      this.configForm.get('chart_type')!.valueChanges.subscribe((type: ChartType) => {
        if (this.isInternalChange) return;
        this.applyChartTypeRules(type);
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ─────────────────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────────────────

  get dimensions(): FormArray {
    return this.configForm.get('dimensions') as FormArray;
  }
  get measures(): FormArray {
    return this.configForm.get('measures') as FormArray;
  }
  get hasValidationErrors(): boolean {
    return this.validationErrors.length > 0;
  }
  get isKpi(): boolean {
    return this.configForm.get('chart_type')?.value === 'kpi';
  }
  get currentChartType(): ChartType {
    return this.configForm.get('chart_type')?.value;
  }
  get currentColorScheme(): string {
    return this.configForm.get('color_scheme')?.value;
  }

  /** Recomputed every CD cycle — derived state, cannot go stale. */
  get isDirty(): boolean {
    if (!this.selectedWidget || !this.currentWidgetId) return false;
    if (!this.configForm.valid) return false;
    const config = this.buildConfigFromForm();
    if (!config) return false;
    return this.signatureOf(config) !== this.lastPersistedSignature;
  }

  // ─────────────────────────────────────────────────────────
  // Chart type / scheme
  // ─────────────────────────────────────────────────────────

  setChartType(type: ChartType): void {
    if (this.configForm.get('chart_type')?.value === type) return;
    this.configForm.get('chart_type')?.setValue(type);
  }

  setColorScheme(scheme: string): void {
    if (this.configForm.get('color_scheme')?.value === scheme) return;
    this.configForm.get('color_scheme')?.setValue(scheme);
  }

  private applyChartTypeRules(type: ChartType): void {
    this.isInternalChange = true;

    if (type === 'kpi') {
      while (this.dimensions.length) {
        this.dimensions.removeAt(0, { emitEvent: false });
      }
      if (this.measures.length === 0) {
        this.measures.push(this.createMeasureGroup(), { emitEvent: false });
      }
      while (this.measures.length > 1) {
        this.measures.removeAt(this.measures.length - 1, { emitEvent: false });
      }
    } else if (this.dimensions.length === 0) {
      this.dimensions.push(this.createDimensionGroup(), { emitEvent: false });
    }

    this.isInternalChange = false;

    // Manually trigger — we suppressed all emissions above.
    this.updateDraftConfig();
  }

  // ─────────────────────────────────────────────────────────
  // Datasets / columns
  // ─────────────────────────────────────────────────────────

  private mapDatasets(raw: any[]): DatasetInfo[] {
    return (raw || []).map((md): DatasetInfo => ({
      id: md.dataset_id ?? md.dataset?.id,
      name:
        md.alias ||
        md.dataset?.source_table ||
        md.dataset?.filename ||
        `Dataset ${md.dataset_id}`,
      columns: this.extractColumns(md.dataset),
    }));
  }

  private extractColumns(dataset: any): { name: string; type: string }[] {
    if (!dataset) return [];
    const raw = dataset.column_schema;
    const refined = dataset.refined_column_schema;
    const source = refined || raw;
    if (!source) return [];

    if (Array.isArray(source)) {
      return source
        .filter((c: any) => c)
        .map((c: any) => ({
          name: c.name ?? c.column ?? '?',
          type: String(c.type ?? c.dtype ?? c.data_type ?? 'unknown').toLowerCase(),
        }));
    }

    if (typeof source === 'object') {
      return Object.entries(source).map(([name, info]: [string, any]) => ({
        name,
        type: String(
          (typeof info === 'object'
            ? info?.type ?? info?.dtype ?? info?.data_type
            : info) ?? 'unknown'
        ).toLowerCase(),
      }));
    }
    return [];
  }

  getColumnsForDimension(index: number): { name: string; type: string }[] {
    const g = this.dimensions.at(index) as FormGroup;
    if (!g) return [];
    return this.columnsFor(g.get('dataset_id')?.value);
  }

  getColumnsForMeasure(index: number): { name: string; type: string }[] {
    const g = this.measures.at(index) as FormGroup;
    if (!g) return [];
    return this.columnsFor(g.get('dataset_id')?.value);
  }

  private columnsFor(datasetId: number | null): { name: string; type: string }[] {
    if (datasetId == null) return [];
    return this.datasets.find((d) => d.id === datasetId)?.columns ?? [];
  }

  // ─────────────────────────────────────────────────────────
  // Form construction
  // ─────────────────────────────────────────────────────────

  private populateForm(config: WidgetConfig): void {
    this.isInternalChange = true;

    while (this.dimensions.length) {
      this.dimensions.removeAt(0, { emitEvent: false });
    }
    while (this.measures.length) {
      this.measures.removeAt(0, { emitEvent: false });
    }

    this.configForm.patchValue(
      {
        title: config.title,
        chart_type: config.chart_type,
        color_scheme: config.color_scheme || 'default',
      },
      { emitEvent: false }
    );

    (config.dimensions || []).forEach((d) => {
      this.dimensions.push(this.createDimensionGroup(d), { emitEvent: false });
    });
    (config.measures || []).forEach((m) => {
      this.measures.push(this.createMeasureGroup(m), { emitEvent: false });
    });

    if (this.dimensions.length === 0 && config.chart_type !== 'kpi') {
      this.dimensions.push(this.createDimensionGroup(), { emitEvent: false });
    }
    if (this.measures.length === 0) {
      this.measures.push(this.createMeasureGroup(), { emitEvent: false });
    }

    this.isInternalChange = false;
  }

  private resetForm(): void {
    this.isInternalChange = true;

    this.configForm.reset(
      {
        title: '',
        chart_type: 'bar',
        color_scheme: 'default',
        dimensions: [],
        measures: [],
      },
      { emitEvent: false }
    );
    while (this.dimensions.length) {
      this.dimensions.removeAt(0, { emitEvent: false });
    }
    while (this.measures.length) {
      this.measures.removeAt(0, { emitEvent: false });
    }

    this.validationErrors = [];
    this.lastPreviewedSignature = '';
    this.isInternalChange = false;
  }

  private createDimensionGroup(dim?: ColumnRef): FormGroup {
    const fallbackId = this.datasets[0]?.id ?? null;
    return this.fb.group({
      dataset_id: [dim?.dataset_id ?? fallbackId, Validators.required],
      column: [dim?.column ?? '', Validators.required],
    });
  }

  private createMeasureGroup(measure?: MeasureSpec): FormGroup {
    const fallbackId = this.datasets[0]?.id ?? null;
    return this.fb.group({
      dataset_id: [measure?.dataset_id ?? fallbackId, Validators.required],
      column: [measure?.column ?? '', Validators.required],
      aggregation: [measure?.aggregation ?? 'SUM', Validators.required],
      alias: [measure?.alias ?? ''],
    });
  }

  // ─────────────────────────────────────────────────────────
  // Form mutations (user actions — these SHOULD emit)
  // ─────────────────────────────────────────────────────────

  addDimension(): void {
    this.dimensions.push(this.createDimensionGroup());
  }
  addMeasure(): void {
    this.measures.push(this.createMeasureGroup());
  }
  removeDimension(i: number): void {
    this.dimensions.removeAt(i);
  }
  removeMeasure(i: number): void {
    this.measures.removeAt(i);
  }

  onDatasetChange(index: number, kind: 'dimension' | 'measure'): void {
    const g =
      kind === 'dimension' ? this.dimensions.at(index) : this.measures.at(index);
    g?.get('column')?.setValue('');
  }

  // ─────────────────────────────────────────────────────────
  // Config building
  // ─────────────────────────────────────────────────────────

  private signatureOf(config: WidgetConfig | null): string {
    if (!config) return '';
    return JSON.stringify({
      t: config.title,
      ct: config.chart_type,
      cs: config.color_scheme,
      d: config.dimensions,
      m: config.measures,
      f: config.filters,
      o: config.order_by,
      l: config.limit,
    });
  }

  private buildConfigFromForm(): WidgetConfig | null {
    if (!this.selectedWidget) return null;
    const v = this.configForm.value;

    return {
      ...this.selectedWidget.config, // preserves model_id, filters, etc.
      title: v.title,
      chart_type: v.chart_type as ChartType,
      color_scheme: v.color_scheme,
      dimensions: (v.dimensions as any[]).map((d) => ({
        dataset_id: d.dataset_id,
        column: d.column,
      })),
      measures: (v.measures as any[]).map((m) => ({
        dataset_id: m.dataset_id,
        column: m.column,
        aggregation: m.aggregation as Aggregation,
        alias: m.alias || null,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────

  private validateLocally(v: any): string[] {
    const errs: string[] = [];
    const dims: any[] = v.dimensions ?? [];
    const meas: any[] = v.measures ?? [];
    const type: ChartType = v.chart_type;

    if (type === 'kpi') {
      if (meas.length !== 1) errs.push('KPI requires exactly one measure.');
      if (dims.length > 0) errs.push('KPI cannot have dimensions.');
      return errs;
    }

    if (dims.length === 0 && meas.length === 0) {
      errs.push('Widget must have at least one dimension or measure.');
    }
    dims.forEach((d, i) => {
      if (!d.dataset_id) errs.push(`Dimension ${i + 1}: dataset required.`);
      if (!d.column) errs.push(`Dimension ${i + 1}: column required.`);
    });
    meas.forEach((m, i) => {
      if (!m.dataset_id) errs.push(`Measure ${i + 1}: dataset required.`);
      if (!m.column) errs.push(`Measure ${i + 1}: column required.`);
      if (!m.aggregation) errs.push(`Measure ${i + 1}: aggregation required.`);
      if (meas.length > 1 && !m.alias) {
        errs.push(`Measure ${i + 1}: alias required when multiple measures.`);
      }
    });
    return errs;
  }

  // ─────────────────────────────────────────────────────────
  // Preview (does NOT persist)
  // ─────────────────────────────────────────────────────────

  private updateDraftConfig(): void {
    if (!this.currentWidgetId || !this.selectedWidget) return;

    const config = this.buildConfigFromForm();
    if (!config) return;

    const localErrors = this.validateLocally(this.configForm.value);
    this.validationErrors = localErrors;

    if (localErrors.length) {
      // IMPORTANT: do NOT wipe chart_data. Leave last-good render on screen.
      return;
    }

    const sig = this.signatureOf(config);
    if (sig === this.lastPreviewedSignature) return;
    this.lastPreviewedSignature = sig;

    this.editorService.setDraftConfig(config);
    this.previewWidgetData(config);
  }

  private previewWidgetData(config: WidgetConfig): void {
    const modelId = config.model_id;
    if (!modelId) {
      this.validationErrors = ['Widget has no model. Reload the dashboard.'];
      return;
    }

    this.isPreviewLoading = true;

    this.dashboardService.getWidgetData(modelId, config).subscribe({
      next: (res) => {
        this.isPreviewLoading = false;
        this.validationErrors = [];
        if (!this.selectedWidget) return;
        this.editorService.updateWidgetLocally(this.selectedWidget.id, {
          ...this.selectedWidget,
          config,
          chart_data: res.chart_data,
        });
      },
      error: (err) => {
        this.isPreviewLoading = false;
        this.validationErrors = this.extractErrors(err);
        // IMPORTANT: leave last-good chart_data intact.
        // Just update the config so the user sees what failed.
        if (this.selectedWidget) {
          this.editorService.updateWidgetLocally(this.selectedWidget.id, {
            ...this.selectedWidget,
            config,
          });
        }
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  // Save (persists)
  // ─────────────────────────────────────────────────────────

  onSave(): void {
    if (!this.currentWidgetId || !this.selectedWidget) return;

    const localErrors = this.validateLocally(this.configForm.value);
    if (localErrors.length) {
      this.validationErrors = localErrors;
      return;
    }

    const config = this.buildConfigFromForm();
    if (!config) return;

    this.isSaving = true;
    this.validationErrors = [];

    this.editorService.saveWidget(this.currentWidgetId, config).subscribe({
      next: (updated) => {
        this.isSaving = false;
        this.lastPersistedSignature = this.signatureOf(updated.config);
        this.editorService.clearWidgetDirty(this.currentWidgetId!);
      },
      error: (err) => {
        this.isSaving = false;
        this.validationErrors = this.extractErrors(err);
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  // Error normalization
  // ─────────────────────────────────────────────────────────

  private extractErrors(err: any): string[] {
    const detail = err?.error?.detail ?? err?.error ?? err?.message;
    if (Array.isArray(detail)) {
      return detail.map((d: any) =>
        typeof d === 'string' ? d : d?.msg ?? JSON.stringify(d)
      );
    }
    if (detail && Array.isArray(detail.errors)) return detail.errors.map(String);
    if (typeof detail === 'string') return [detail];
    if (detail && typeof detail === 'object')
      return Object.values(detail).map(String);
    return ['Unable to validate the widget configuration.'];
  }
}