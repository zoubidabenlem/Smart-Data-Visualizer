// src/app/features/dashboards/components/widget-config-dialog/widget-config-dialog.component.ts
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DashboardService } from 'src/app/core/services/dashboard.service';
import { DatasetService } from 'src/app/core/services/dataset.service';
import { WidgetConfig, WidgetResponse } from 'src/app/core/models/dashboard.model';
import { DatasetOut } from 'src/app/core/models/dataset.model';

export interface WidgetDialogData {
  dashboardId: number;
  widget?: WidgetResponse;
  preSelectedDatasetId?: number;
  defaultChartType?: 'chart' | 'kpi';
}

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

  constructor(
    private fb: FormBuilder,
    private dashboardService: DashboardService,
    private datasetService: DatasetService,
    private dialogRef: MatDialogRef<WidgetConfigDialogComponent>,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: WidgetDialogData
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadDatasets();
    console.log('Dialog data:', this.data);
    if (this.data.widget) {
      this.isEditMode = true;
      this.widgetId = this.data.widget.id;
      this.patchFormWithWidget(this.data.widget.config);
    } else if (this.data.preSelectedDatasetId) {
      // Pre-select dataset and load its columns
      this.form.patchValue({ dataset_id: this.data.preSelectedDatasetId });
      this.onDatasetChange(this.data.preSelectedDatasetId);
    }

    if (this.data.defaultChartType === 'kpi') {
      this.form.patchValue({ chart_type: 'kpi' });
      this.toggleFieldsBasedOnChartType('kpi');
    }
  }

  private initForm(): void {
    this.form = this.fb.group({
      dataset_id: [null, Validators.required],
      chart_type: ['bar', Validators.required],
      title: ['', Validators.required],
      x_column: [null],
      y_column: [null],
      filters: this.fb.array([]),
      group_by: [null],
      agg_func: [null],
      value_col: [null],
      missing_config: this.fb.group({
        default: ['drop'],
        default_fill_value: [null],
        overrides: this.fb.group({})
      }),
      color_scheme: ['default']
    });

    this.addFilter(); // start with one empty filter

    this.form.get('chart_type')?.valueChanges.subscribe(ct => this.toggleFieldsBasedOnChartType(ct));

    // Aggregation validation
    const aggFields = ['group_by', 'agg_func', 'value_col'];
    aggFields.forEach(field => {
      this.form.get(field)?.valueChanges.subscribe(() => this.validateAggregation());
    });
  }

  private toggleFieldsBasedOnChartType(chartType: string): void {
    const isKpi = chartType === 'kpi';
    const xControl = this.form.get('x_column');
    const yControl = this.form.get('y_column');
    if (isKpi) {
      xControl?.disable();
      yControl?.disable();
      xControl?.setValue(null);
      yControl?.setValue(null);
    } else {
      xControl?.enable();
      yControl?.enable();
    }
  }

  private validateAggregation(): void {
    const groupBy = this.form.get('group_by')?.value;
    const aggFunc = this.form.get('agg_func')?.value;
    const valueCol = this.form.get('value_col')?.value;
    const allPresent = groupBy && aggFunc && valueCol;
    const nonePresent = !groupBy && !aggFunc && !valueCol;
    if (!allPresent && !nonePresent) {
      this.form.setErrors({ aggregationInvalid: true });
    } else {
      if (this.form.hasError('aggregationInvalid')) {
        const errors = this.form.errors;
        delete errors?.['aggregationInvalid'];
        this.form.setErrors(Object.keys(errors || {}).length ? errors : null);
      }
    }
  }

  get filtersArray(): FormArray {
    return this.form.get('filters') as FormArray;
  }

  addFilter(): void {
    const filterGroup = this.fb.group({
      column: ['', Validators.required],
      operator: ['==', Validators.required],
      value: ['', Validators.required]
    });
    this.filtersArray.push(filterGroup);
  }

  removeFilter(index: number): void {
    this.filtersArray.removeAt(index);
  }

  private loadDatasets(): void {
    this.datasetService.getDatasets().subscribe({
      next: (ds) => this.datasets = ds,
      error: (err) => console.error('Failed to load datasets', err)
    });
  }

  // Called when dataset selection changes (dropdown or programmatically)
  onDatasetChange(datasetId: number): void {
  if (!datasetId) {
    this.columns = [];
    return;
  }
  console.log('Loading columns for dataset ID:', datasetId);
  this.datasetService.getDatasetColumns(datasetId).subscribe({
    next: (response: any) => {
      console.log('Raw columns response:', response);
      // Extract the columns array from the response object
      const colsArray = response?.columns || [];
      console.log('Columns array:', colsArray);
      // Map to column names (adjust property names as needed)
      this.columns = colsArray.map((col: any) => col.name || col.column_name);
      console.log('Mapped column names:', this.columns);
      if (this.columns.length === 0) {
        this.snackBar.open('No columns found for this dataset', 'Close', { duration: 3000 });
      }
      // Reset dependent fields
      this.form.patchValue({
        x_column: null,
        y_column: null,
        group_by: null,
        value_col: null
      });
      // Reset filters (optional)
      while (this.filtersArray.length) this.filtersArray.removeAt(0);
      this.addFilter();
    },
    error: (err) => {
      console.error('Failed to load columns', err);
      this.columns = [];
      this.snackBar.open('Could not load columns', 'Close', { duration: 3000 });
    }
  });
}

  private patchFormWithWidget(config: WidgetConfig): void {
    this.form.patchValue({
      dataset_id: config.dataset_id,
      chart_type: config.chart_type,
      title: config.title,
      x_column: config.x_column,
      y_column: config.y_column,
      group_by: config.group_by ? config.group_by[0] : null, // assuming group_by is array with single value
      agg_func: config.agg_func,
      value_col: config.value_col,
      color_scheme: config.color_scheme || 'default'
    });
    if (config.missing_config) {
      this.form.get('missing_config')?.patchValue(config.missing_config);
    }
    // Patch filters
    if (config.filters && config.filters.length) {
      while (this.filtersArray.length) this.filtersArray.removeAt(0);
      config.filters.forEach(f => {
        const fg = this.fb.group({
          column: [f.column, Validators.required],
          operator: [f.operator, Validators.required],
          value: [f.value, Validators.required]
        });
        this.filtersArray.push(fg);
      });
    }
    // Load columns for the dataset after patching the dataset_id
    this.onDatasetChange(config.dataset_id);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.snackBar.open('Please fix form errors', 'Close', { duration: 3000 });
      return;
    }

    const rawValue = this.form.getRawValue();
    const config: WidgetConfig = {
      dataset_id: rawValue.dataset_id,
      chart_type: rawValue.chart_type,
      title: rawValue.title,
      x_column: rawValue.x_column || null,
      y_column: rawValue.y_column || null,
      filters: rawValue.filters.filter((f: any) => f.column && f.operator && f.value !== undefined),
      group_by: rawValue.group_by ? [rawValue.group_by] : null,
      agg_func: rawValue.agg_func || null,
      value_col: rawValue.value_col || null,
      missing_config: rawValue.missing_config,
      color_scheme: rawValue.color_scheme
    };

    // Aggregation validation
    if (config.chart_type !== 'kpi') {
    const hasGroup = !!config.group_by;
    const hasAgg = !!config.agg_func;
    const hasValue = !!config.value_col;
    if ((hasGroup || hasAgg || hasValue) && !(hasGroup && hasAgg && hasValue)) {
      this.snackBar.open('Aggregation must be all three or none', 'Close', { duration: 3000 });
      return;
    }
  }

    this.isLoading = true;
    if (this.isEditMode && this.widgetId) {
      this.dashboardService.updateWidget(this.data.dashboardId, this.widgetId, { config }).subscribe({
        next: () => {
          this.snackBar.open('Widget updated', 'Close', { duration: 2000 });
          this.dialogRef.close(true);
        },
        error: (err) => {
          console.error(err);
          this.snackBar.open('Update failed', 'Close', { duration: 3000 });
          this.isLoading = false;
        }
      });
    } else {
      this.dashboardService.addWidget(this.data.dashboardId, { config }).subscribe({
        next: () => {
          this.snackBar.open('Widget created', 'Close', { duration: 2000 });
          this.dialogRef.close(true);
        },
        error: (err) => {
          console.error(err);
          this.snackBar.open('Creation failed', 'Close', { duration: 3000 });
          this.isLoading = false;
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}