// src/app/features/dashboards/components/widget-config-dialog/widget-config-dialog.component.ts
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DashboardService } from 'src/app/core/services/dashboard.service';
import { DatasetService } from 'src/app/core/services/dataset.service';
import {
  WidgetConfig,
  WidgetResponse,
  AggregationSpec,
  MissingConfig,
  MissingOverride
} from 'src/app/core/models/dashboard.model';
import { DatasetOut } from 'src/app/core/models/dataset.model';
import { Observable } from 'rxjs';

export interface WidgetDialogData {
  dashboardId: number;
  widget?: WidgetResponse;
  preSelectedDatasetId?: number;
  defaultChartType?: 'chart' | 'kpi';
}
import { ChangeDetectorRef } from '@angular/core';


@Component({
  selector: 'app-widget-config-dialog',
  templateUrl: './widget-config-dialog.component.html',
  styleUrls: ['./widget-config-dialog.component.css']
})
export class WidgetConfigDialogComponent implements OnInit {
  form!: FormGroup;
  datasets: DatasetOut[] = [];
  columns: string[] = [];
  isLoading = false;
  isEditMode = false;
  widgetId?: number;

  chartTypes = ['bar', 'line', 'pie', 'scatter', 'area', 'heatmap', 'kpi'];
  aggregationFunctions = ['SUM', 'MEAN', 'COUNT', 'MAX', 'MIN'];
  operators = ['==', '!=', '>', '<', 'in', 'like'];

  // Predefined colour schemes (align with backend)
  colorSchemes = [
    'default',
    'pastel',
    'dark',
  ];

  constructor(
    private fb: FormBuilder,
    private dashboardService: DashboardService,
    private datasetService: DatasetService,
    private dialogRef: MatDialogRef<WidgetConfigDialogComponent>,
    private snackBar: MatSnackBar,
    private cdr:ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) public data: WidgetDialogData
  ) {
    console.log('[WidgetConfigDialog] constructed', {
      dashboardId: this.data?.dashboardId,
      hasWidget: !!this.data?.widget,
      preSelectedDatasetId: this.data?.preSelectedDatasetId,
      defaultChartType: this.data?.defaultChartType
    });
  }

  ngOnInit(): void {
    console.log('[WidgetConfigDialog] ngOnInit start', this.data);
    this.initForm();
    this.loadDatasets();

    if (this.data.widget) {
      this.isEditMode = true;
      this.widgetId = this.data.widget.id;
      this.patchFormWithWidget(this.data.widget.config);
    } else if (this.data.preSelectedDatasetId) {
      this.form.patchValue({ dataset_id: this.data.preSelectedDatasetId });
      this.onDatasetChange(this.data.preSelectedDatasetId);
    }

    if (this.data.defaultChartType === 'kpi') {
      this.form.patchValue({ chart_type: 'kpi' });
    }

    this.form.get('chart_type')?.valueChanges.subscribe(ct => this.toggleFieldsBasedOnChartType(ct));
  }

  // ---------- Form structure ----------
  private initForm(): void {
    console.log('[WidgetConfigDialog] initForm start');
    this.form = this.fb.group({
      dataset_id: [null, Validators.required],
      chart_type: ['bar', Validators.required],
      title: ['', Validators.required],
      x_column: [null],
      y_column: [null],
      filters: this.fb.array([]),
      group_by: [[]],              // ← replaces agg_func/value_col
      missing_config: this.fb.group({
        default: ['drop'],
        default_fill_value: [null],
        overrides: this.fb.array([])              // dynamic per‑column overrides
      }),
      color_scheme: ['default'],
      aggregations: this.fb.array([]),            // ← replaces agg_func/value_col

    });
          // When aggregations change, reset y_column because the options may have changed
    this.aggregationsArray.valueChanges.subscribe(() => {
  // Recompute the dropdown options first
  this.updatePieValueColumnOptions();
    this.updateAggregationValueOptions();   


  // Now check if y_column is still valid
  const yVal = this.form.get('y_column')?.value;
  if (yVal && !this.pieValueColumnOptions.find(opt => opt.value === yVal)) {
    // Defer the patch to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.form.patchValue({ y_column: null }, { emitEvent: false });
      this.cdr.detectChanges();
    }, 0);
  }
  if (yVal && !this.aggregationValueOptions.find(opt => opt.value === yVal)) {
    setTimeout(() => {
      this.form.patchValue({ y_column: null }, { emitEvent: false });
      this.cdr.detectChanges();
    }, 0);
  }
});

    this.addAggregation();   // start with one aggregation row
    this.updatePieValueColumnOptions();
    this.updateAggregationValueOptions();
    this.addFilter();        // one empty filter

    // Conditional validation for KPI
      this.form.get('chart_type')?.valueChanges.subscribe(ct =>
    this.toggleFieldsBasedOnChartType(ct)
  );
  }
// Inside the class, after initForm()

// Replace the getter with a mutable property
pieValueColumnOptions: { label: string; value: string }[] = [];

// Helper to recompute the options
private updatePieValueColumnOptions(): void {
  const aggs = (this.aggregationsArray?.value || []) as AggregationSpec[];
  this.pieValueColumnOptions = aggs
    .filter((a: any) => a && a.value_col)    // only rows with a selected column
    .map((a: any) => {
      const colName = a.value_col;
      const funcName = a.agg_func || 'SUM';
      return {
        label: a.alias?.trim() || `${colName} (${funcName})`,
        value: a.alias?.trim() || `${colName}_${funcName}`
      };
    });
}
aggregationValueOptions: { label: string; value: string }[] = [];
private updateAggregationValueOptions(): void {
  const aggs = this.aggregationsArray.value as AggregationSpec[];
  this.aggregationValueOptions = aggs
    .filter((a: any) => a && a.value_col)
    .map((a: any) => ({
      label: a.alias?.trim() || `${a.value_col} (${a.agg_func || 'SUM'})`,
      value: a.alias?.trim() || `${a.value_col}_${a.agg_func || 'SUM'}`
    }));
}

 /** Show/hide fields that are irrelevant for certain chart types */
  private toggleFieldsBasedOnChartType(chartType: string): void {
    const isKpi = chartType === 'kpi';
    const isPie = chartType === 'pie';
    const isScatter = chartType === 'scatter';
    const isHeatmap = chartType === 'heatmap';

    const x = this.form.get('x_column');
    const y = this.form.get('y_column');

    

    if (isKpi) {
      x?.disable(); 
      y?.disable();
      x?.setValue(null); 
      y?.setValue(null);
      x?.clearValidators(); 
      y?.clearValidators();
    } else if (isPie || isHeatmap || isScatter) {
      x?.enable(); 
      y?.enable();
      x?.clearValidators();
      y?.setValidators(Validators.required);
    } else {
      x?.enable(); 
      y?.enable();
      x?.setValidators(null);
      y?.setValidators(null);
    }

    // Explicitly recalculate validity state cleanly without triggers
    x?.updateValueAndValidity({ emitEvent: false });
    y?.updateValueAndValidity({ emitEvent: false });
    this.aggregationsArray.updateValueAndValidity({ emitEvent: false });
  }
  // ---- Aggregations FormArray ----
  get aggregationsArray(): FormArray {
    return this.form.get('aggregations') as FormArray;
  }

  

  createAggregationGroup(agg?: AggregationSpec): FormGroup {
    return this.fb.group({
      value_col: [agg?.value_col || '', Validators.required],
      agg_func: [agg?.agg_func || 'SUM', Validators.required],
      alias: [agg?.alias || null]
    });
  }

  addAggregation(): void {
    this.aggregationsArray.push(this.createAggregationGroup());
  }

  removeAggregation(index: number): void {
    if (this.aggregationsArray.length > 1) {
      this.aggregationsArray.removeAt(index);
    } else {
      this.snackBar.open('At least one aggregation is required', 'Close', { duration: 2000 });
    }
  }

  // ---- Filters FormArray ----
  get filtersArray(): FormArray {
    return this.form.get('filters') as FormArray;
  }

  createFilterGroup(): FormGroup {
    return this.fb.group({
      column: ['', Validators.required],
      operator: ['==', Validators.required],
      value: ['', Validators.required]
    });
  }

  addFilter(): void {
    this.filtersArray.push(this.createFilterGroup());
  }

  removeFilter(index: number): void {
    this.filtersArray.removeAt(index);
  }

  // ---- Missing Config Overrides ----
  get overridesArray(): FormArray {
    return (this.form.get('missing_config') as FormGroup).get('overrides') as FormArray;
  }

  createOverrideGroup(override?: { column: string; config: MissingOverride }): FormGroup {
    return this.fb.group({
      column: [override?.column || '', Validators.required],
      strategy: [override?.config?.strategy || 'drop', Validators.required],
      fill_value: [override?.config?.fill_value ?? null]
    });
  }

  addOverride(): void {
    this.overridesArray.push(this.createOverrideGroup());
  }

  removeOverride(index: number): void {
    this.overridesArray.removeAt(index);
  }

  // ---- Data loading ----
  private loadDatasets(): void {
    console.log('[WidgetConfigDialog] loading datasets');
    this.datasetService.getDatasets().subscribe({
      next: (ds) => {
        console.log('[WidgetConfigDialog] datasets loaded', ds);
        this.datasets = ds;
      },
      error: (err) => {
        console.error('[WidgetConfigDialog] Failed to load datasets', err);
      }
    });
  }

  onDatasetChange(datasetId: number): void {
    console.log('[WidgetConfigDialog] onDatasetChange', { datasetId });
    if (!datasetId) {
      this.columns = [];
      return;
    }
    this.datasetService.getDatasetColumns(datasetId).subscribe({
      next: (response: any) => {
        console.log('[WidgetConfigDialog] columns loaded', response);
        const cols = response?.columns || [];
        this.columns = cols.map((col: any) => col.name || col.column_name);
        if (this.columns.length === 0) {
          this.snackBar.open('No columns found', 'Close', { duration: 3000 });
        }
        // Reset dependent fields
        this.form.patchValue({ x_column: null, y_column: null, group_by: [] });
        while (this.filtersArray.length) this.filtersArray.removeAt(0);
        this.addFilter();
      },
      error: (err) => {
        console.error('[WidgetConfigDialog] Failed to load columns', err);
        this.columns = [];
        this.snackBar.open('Could not load columns', 'Close', { duration: 3000 });
      }
    });
  }

  // ---- Patching form when editing ----
  private patchFormWithWidget(config: WidgetConfig): void {
    console.log('[WidgetConfigDialog] patchFormWithWidget', config);
    // Basic fields
    this.form.patchValue({
      dataset_id: config.dataset_id,
      chart_type: config.chart_type,
      title: config.title,
      x_column: config.x_column,
      y_column: config.y_column,
      group_by: config.group_by || [],
      color_scheme: config.color_scheme || 'default'
    });

    // Aggregations
    this.aggregationsArray.clear();
    if (config.aggregations && config.aggregations.length > 0) {
      config.aggregations.forEach(agg => this.aggregationsArray.push(this.createAggregationGroup(agg)));
    } else if (config.agg_func && config.value_col) {
      // Convert legacy single aggregation
      this.aggregationsArray.push(this.createAggregationGroup({
        value_col: config.value_col,
        agg_func: config.agg_func,
        alias: null
      }));
    } else {
      // At least one empty aggregation
      this.aggregationsArray.push(this.createAggregationGroup());
    }

    // Filters
    while (this.filtersArray.length) this.filtersArray.removeAt(0);
    if (config.filters?.length) {
      config.filters.forEach(f => this.filtersArray.push(this.createFilterGroup().patchValue({
        column: f.column,
        operator: f.operator,
        value: f.value
      })));
    } else {
      this.addFilter();
    }

    // Missing config
    const missing = config.missing_config;
    if (missing) {
      const mcGroup = this.form.get('missing_config') as FormGroup;
      mcGroup.patchValue({
        default: missing.default || 'drop',
        default_fill_value: missing.default_fill_value ?? null
      });
      const overrides = mcGroup.get('overrides') as FormArray;
      overrides.clear();
      if (missing.overrides) {
        Object.entries(missing.overrides).forEach(([column, val]) => {
          if (typeof val === 'object' && val !== null && 'strategy' in val) {
            overrides.push(this.createOverrideGroup({ column, config: val as MissingOverride }));
          } else {
            // Fallback for string shortcut
            overrides.push(this.createOverrideGroup({ column, config: { strategy: val as any, fill_value: null } }));
          }
        });
      }
      // If editing a pie/heatmap widget without a stored y_column, pick the first aggregation
      const chartType = this.form.get('chart_type')?.value;
      if ((chartType === 'pie' || chartType === 'heatmap' || chartType === 'scatter') && !config.y_column) {
        const aggs = config.aggregations || [];
        if (aggs.length > 0) {
          const firstAgg = aggs[0];
          const alias = firstAgg.alias || `${firstAgg.value_col}_${firstAgg.agg_func}`;
          this.form.patchValue({ y_column: alias });
        }
      }
    }

    // Load columns for this dataset after patching dataset_id
    this.onDatasetChange(config.dataset_id);
  }

  // ---- Submit ----
  onSubmit(): void {
    console.log('[WidgetConfigDialog] onSubmit start', this.form.getRawValue());
    if (this.form.invalid) {
      this.snackBar.open('Please fix form errors', 'Close', { duration: 3000 });
      return;
    }

    const rawValue = this.form.getRawValue();
    
    // Build aggregations
    const aggregations: AggregationSpec[] = rawValue.aggregations
      .filter((a: any) => a.value_col && a.agg_func)
      .map((a: any) => ({
        value_col: a.value_col,
        agg_func: a.agg_func,
        alias: a.alias?.trim() || null
      }));

    const chartType = this.form.get('chart_type')?.value;
    if (chartType !== 'scatter' && aggregations.length === 0) {
      this.snackBar.open('At least one valid aggregation is required', 'Close', { duration: 3000 });
      return;
    }

    // Build missing_config (only if overrides exist or non‑default settings)
    let missing_config: MissingConfig | null = null;
    const mcGroup = this.form.get('missing_config') as FormGroup;
    const overridesRaw = (mcGroup.get('overrides') as FormArray).controls
      .filter((ctrl: AbstractControl) => ctrl.value.column)
      .map((ctrl: AbstractControl) => ctrl.value);

    if (overridesRaw.length > 0 ||
        mcGroup.value.default !== 'drop' ||
        (mcGroup.value.default === 'fill' && mcGroup.value.default_fill_value !== null)) {
      const overrides: Record<string, MissingOverride> = {};
      overridesRaw.forEach((o: any) => {
        overrides[o.column] = {
          strategy: o.strategy,
          fill_value: o.fill_value ?? null
        };
      });
      missing_config = {
        default: mcGroup.value.default,
        default_fill_value: mcGroup.value.default_fill_value ?? null,
        overrides: overrides
      };
    }

    // Build filters
    const filters = rawValue.filters
      .filter((f: any) => f.column && f.operator && f.value !== undefined)
      .map((f: any) => ({
        column: f.column,
        operator: f.operator,
        value: f.value
      }));

    const config: WidgetConfig = {
      dataset_id: rawValue.dataset_id,
      chart_type: rawValue.chart_type,
      title: rawValue.title,
      x_column: rawValue.x_column || null,
      y_column: rawValue.y_column || null,
      filters,
      group_by: rawValue.group_by.length > 0 ? rawValue.group_by : null,      // Legacy fields set to null – we're using aggregations
      agg_func: null,
      value_col: null,
      aggregations,
      missing_config,
      color_scheme: rawValue.color_scheme || 'default'
    };

    console.log('[WidgetConfigDialog] submitting config', config);
    this.isLoading = true;
    const action = this.isEditMode && this.widgetId
      ? this.dashboardService.updateWidget(this.data.dashboardId, this.widgetId!, { config })
      : this.dashboardService.addWidget(this.data.dashboardId, { config });

    // Cast to Observable<any> to avoid TypeScript union call signature issue
    (action as Observable<any>).subscribe({
      next: () => {
        this.snackBar.open(this.isEditMode ? 'Widget updated' : 'Widget created', 'Close', { duration: 2000 });
        this.dialogRef.close(true);
      },
      error: (err: any) => {
        console.error(err);
        this.snackBar.open('Operation failed. Check console.', 'Close', { duration: 4000 });
        this.isLoading = false;
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}