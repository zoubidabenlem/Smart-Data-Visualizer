import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { DashboardEditorService } from '../../services/dashboard-editor.service';
import { DashboardService } from 'src/app/core/services/dashboard.service';
import {
  WidgetConfig,
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

@Component({
  selector: 'app-widget-config-panel',
  standalone: false,
  templateUrl: './widget-config-panel.component.html',
  styleUrls: ['./widget-config-panel.component.css'],
})
export class WidgetConfigPanelComponent implements OnInit, OnDestroy {
  configForm: FormGroup;
  chartTypes: ChartType[] = ['bar', 'line', 'pie', 'scatter', 'area', 'heatmap', 'kpi'];
  colorSchemes: string[] = ['default', 'pastel', 'dark'];
  datasets: DatasetInfo[] = [];
private get DEBUG(): boolean {
  return (window as any).__dashDebug === true;
}
private log(...args: any[]): void {
  if (this.DEBUG) console.log('[ConfigPanel]', ...args);
}
  /** ─── NEW: backend / frontend validation errors ─── */
  validationErrors: string[] = [];
  isPreviewLoading = false;

  private subscriptions = new Subscription();
  private currentWidgetId: number | null = null;
  private selectedWidget: any = null;
  private isInternalChange = false;
  private datasetsLoaded = false;

  constructor(
    private fb: FormBuilder,
    public editorService: DashboardEditorService,
    private dashboardService: DashboardService
  ) {
    this.configForm = this.fb.group({
      title: ['', Validators.required],
      chart_type: ['bar', Validators.required],
      color_scheme: ['default'],
      dimensions: this.fb.array([]),
      measures: this.fb.array([]),
    });
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.configForm.valueChanges.pipe(debounceTime(150)).subscribe(() => {
        if (!this.isInternalChange && this.currentWidgetId) {
          this.updateDraftConfig();
        }
      })
    );

   // ─── FIX 3: react to chart_type changes ───
this.subscriptions.add(
  this.configForm.get('chart_type')!.valueChanges.subscribe((type: string) => {
    if (this.isInternalChange) return;
    this.log('chart_type changed to', type);

    if (type === 'kpi') {
      // KPI needs exactly 1 measure and 0 dimensions
      while (this.dimensions.length) this.dimensions.removeAt(0);
      if (this.measures.length === 0) this.addMeasure();
      if (this.measures.length > 1) {
        while (this.measures.length > 1) this.measures.removeAt(this.measures.length - 1);
      }
    } else if (this.dimensions.length === 0) {
      this.addDimension();
    }
  })
);

    this.subscriptions.add(
      this.editorService.datasets$.subscribe(datasets => {
        this.datasets = datasets.map((md: any): DatasetInfo => ({
          id: md.dataset_id ?? md.dataset?.id,
          name: md.alias || md.dataset?.name || 'Unnamed dataset',
          columns: this.extractColumns(md.dataset),
        }));
        this.datasetsLoaded = true;

        if (this.selectedWidget) {
          this.populateForm(this.selectedWidget.config);
        }
      })
    );
  }

  // ------------------------------------------------------------------
  // Convenience getters
  // ------------------------------------------------------------------

  get dimensions(): FormArray {
    return this.configForm.get('dimensions') as FormArray;
  }

  get measures(): FormArray {
    return this.configForm.get('measures') as FormArray;
  }

  /** ─── NEW: template helper — show error banner when present ─── */
  get hasValidationErrors(): boolean {
    return this.validationErrors.length > 0;
  }

  // ------------------------------------------------------------------
  // Column helpers
  // ------------------------------------------------------------------

  private extractColumns(dataset: any): { name: string; type: string }[] {
    if (!dataset) return [];

    const raw = dataset.column_schema;
    const refined = dataset.refined_column_schema;

    const typeLookup: Record<string, string> = {};
    if (refined && !Array.isArray(refined) && typeof refined === 'object') {
      Object.entries(refined).forEach(([n, info]: [string, any]) => {
        typeLookup[n] = this.normalizeType(
          typeof info === 'object' ? info.type || info.dtype || 'string' : info
        );
      });
    } else if (Array.isArray(refined)) {
      refined.forEach((c: any) => {
        if (c && c.name) typeLookup[c.name] = this.normalizeType(c.type || c.dtype || 'string');
      });
    }

    const schema = raw || refined;
    if (!schema) return [];

    if (Array.isArray(schema)) {
      return schema
        .filter((c: any) => c && c.name)
        .map((c: any) => ({
          name: c.name,
          type: this.normalizeType(
            typeLookup[c.name] ?? c.type ?? c.dtype ?? c.data_type ?? 'string'
          ),
        }));
    }

    if (typeof schema === 'object') {
      return Object.entries(schema)
        .filter(([name]) => !!name)
        .map(([name, info]: [string, any]) => ({
          name,
          type: this.normalizeType(
            typeLookup[name] ??
              (typeof info === 'object'
                ? info.type || info.dtype || info.data_type
                : info) ??
              'string'
          ),
        }));
    }

    return [];
  }

  private normalizeType(type: any): string {
    return String(type || 'string').toLowerCase();
  }

  private getColumnsForDataset(datasetId: number): { name: string; type: string }[] {
    const ds = this.datasets.find(d => d.id === datasetId);
    return ds ? ds.columns : [];
  }

  getColumnsForDimension(index: number): { name: string; type: string }[] {
    const g = this.dimensions.at(index) as FormGroup;
    return g ? this.getColumnsForDataset(g.get('dataset_id')?.value) : [];
  }

  getColumnsForMeasure(index: number): { name: string; type: string }[] {
    const g = this.measures.at(index) as FormGroup;
    return g ? this.getColumnsForDataset(g.get('dataset_id')?.value) : [];
  }

  // ------------------------------------------------------------------
  // Form construction
  // ------------------------------------------------------------------

  private populateForm(config: WidgetConfig): void {
    this.isInternalChange = true;

    if (!this.datasetsLoaded || this.datasets.length === 0) {
      this.isInternalChange = false;
      return;
    }

    while (this.dimensions.length) this.dimensions.removeAt(0);
    while (this.measures.length) this.measures.removeAt(0);

    this.configForm.patchValue(
      {
        title: config.title,
        chart_type: config.chart_type,
        color_scheme: config.color_scheme || 'default',
      },
      { emitEvent: false }
    );

    (config.dimensions || []).forEach(dim => {
      const valid = this.getColumnsForDataset(dim.dataset_id).some(c => c.name === dim.column);
      this.dimensions.push(
        this.createDimensionGroup({
          dataset_id: dim.dataset_id,
          column: valid ? dim.column : '',
        })
      );
    });

    (config.measures || []).forEach(measure => {
      const valid = this.getColumnsForDataset(measure.dataset_id).some(c => c.name === measure.column);
      this.measures.push(
        this.createMeasureGroup({ ...measure, column: valid ? measure.column : '' })
      );
    });

    if (this.dimensions.length === 0) this.addDimension();
    if (this.measures.length === 0) this.addMeasure();

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
    while (this.dimensions.length) this.dimensions.removeAt(0);
    while (this.measures.length) this.measures.removeAt(0);
    this.validationErrors = [];
    this.isInternalChange = false;
  }

  private createDimensionGroup(dim?: ColumnRef): FormGroup {
    const datasetId = dim?.dataset_id || (this.datasets.length > 0 ? this.datasets[0].id : null);
    return this.fb.group({
      dataset_id: [datasetId, Validators.required],
      column: [dim?.column || '', Validators.required],
    });
  }

  private createMeasureGroup(measure?: MeasureSpec): FormGroup {
    const datasetId = measure?.dataset_id || (this.datasets.length > 0 ? this.datasets[0].id : null);
    return this.fb.group({
      dataset_id: [datasetId, Validators.required],
      column: [measure?.column || '', Validators.required],
      aggregation: [measure?.aggregation || 'SUM', Validators.required],
      alias: [measure?.alias || ''],
    });
  }

  // ------------------------------------------------------------------
  // Form mutations
  // ------------------------------------------------------------------

  addDimension(): void {
    this.dimensions.push(this.createDimensionGroup());
  }

  addMeasure(): void {
    this.measures.push(this.createMeasureGroup());
  }

  removeDimension(index: number): void {
    this.dimensions.removeAt(index);
  }

  removeMeasure(index: number): void {
    this.measures.removeAt(index);
  }

  onDatasetChange(index: number, type: 'dimension' | 'measure'): void {
    const group = type === 'dimension' ? this.dimensions.at(index) : this.measures.at(index);
    group?.get('column')?.setValue('');
  }

  // ------------------------------------------------------------------
  // Validation & preview
  // ------------------------------------------------------------------

  /** Frontend-only sanity check used BEFORE sending anything. */
  private validateLocally(formValue: any): string[] {
    const errors: string[] = [];
    const dims: any[] = formValue.dimensions ?? [];
    const meas: any[] = formValue.measures ?? [];

    if (dims.length === 0 && meas.length === 0) {
      errors.push('Widget must have at least one dimension or measure.');
    }

    dims.forEach((d, i) => {
      if (!d.dataset_id) errors.push(`Dimension ${i + 1}: dataset is required.`);
      if (!d.column) errors.push(`Dimension ${i + 1}: column is required.`);
    });
    meas.forEach((m, i) => {
      if (!m.dataset_id) errors.push(`Measure ${i + 1}: dataset is required.`);
      if (!m.column) errors.push(`Measure ${i + 1}: column is required.`);
      if (!m.aggregation) errors.push(`Measure ${i + 1}: aggregation is required.`);
    });

    return errors;
  }

  private updateDraftConfig(): void {
    if (!this.currentWidgetId || !this.selectedWidget) return;

    const formValue = this.configForm.value;
    const localErrors = this.validateLocally(formValue);

    if (localErrors.length) {
      this.validationErrors = localErrors;
      // Clear stale data so the chart does not render an invalid config.
      this.editorService.updateWidgetLocally(this.selectedWidget.id, {
        ...this.selectedWidget,
        chart_data: [],
      });
      return;
    }

    const config: WidgetConfig = {
      ...this.selectedWidget.config,
      title: formValue.title,
      chart_type: formValue.chart_type as ChartType,
      color_scheme: formValue.color_scheme,
      dimensions: formValue.dimensions.map((d: any) => ({
        dataset_id: d.dataset_id,
        column: d.column,
      })),
      measures: formValue.measures.map((m: any) => ({
        dataset_id: m.dataset_id,
        column: m.column,
        aggregation: m.aggregation as Aggregation,
        alias: m.alias || null,
      })),
    };

    this.editorService.setDraftConfig(config);
    this.previewWidgetData(config);
  }

  private previewWidgetData(config: WidgetConfig): void {
    const modelId = config.model_id;
    if (!modelId) {
      this.validationErrors = ['Cannot preview: widget has no model_id.'];
      return;
    }

    this.isPreviewLoading = true;

    this.dashboardService.getWidgetData(modelId, config).subscribe({
      next: (res) => {
        this.isPreviewLoading = false;
        this.validationErrors = [];           // ─── clear on success ───

        if (!this.selectedWidget) return;

        const widgetWithData = {
          ...this.selectedWidget,
          config,
          chart_data: res.chart_data,
        };
        this.editorService.updateWidgetLocally(this.selectedWidget.id, widgetWithData);
      },
      error: (err) => {
        this.isPreviewLoading = false;
        this.validationErrors = this.extractErrors(err);
        // Wipe chart_data so the chart hides stale/invalid visuals.
        if (this.selectedWidget) {
          this.editorService.updateWidgetLocally(this.selectedWidget.id, {
            ...this.selectedWidget,
            config,
            chart_data: [],
          });
        }
      },
    });
  }

  /** Normalize whatever FastAPI sends into a flat list of strings. */
  private extractErrors(err: any): string[] {
    const detail = err?.error?.detail ?? err?.error ?? err?.message;

    if (Array.isArray(detail)) {
      return detail.map((d: any) =>
        typeof d === 'string' ? d : d?.msg ?? JSON.stringify(d)
      );
    }
    if (detail && Array.isArray(detail.errors)) return detail.errors.map(String);
    if (typeof detail === 'string') return [detail];
    if (detail && typeof detail === 'object') return Object.values(detail).map(String);

    return ['Unable to validate the widget configuration.'];
  }

  saveConfig(): void {
    if (this.configForm.valid) {
      this.updateDraftConfig();
    }
  }

  getChartIcon(type: string): string {
    switch (type) {
      case 'bar': return 'bar_chart';
      case 'line': return 'show_chart';
      case 'pie': return 'pie_chart';
      case 'scatter': return 'scatter_plot';
      case 'area': return 'area_chart';
      case 'heatmap': return 'grid_on';
      case 'kpi': return 'assessment';
      default: return 'insert_chart';
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}