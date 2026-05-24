import { Injectable } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ValidationErrors, AbstractControl } from '@angular/forms';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { ChartType, AggFunc } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardBuilderStateService {
  form!: FormGroup;

  // Observables for each step to control enable/disable
  datasetId$!: Observable<number | null>;
  chartType$!: Observable<ChartType | null>;
  step1Valid$!: Observable<boolean>;
  step2Valid$!: Observable<boolean>;
  step3Valid$!: Observable<boolean>;
  step4Valid$!: Observable<boolean>;
  step5Valid$!: Observable<boolean>;

  // Column metadata for the selected dataset (fetched from dataset service)
  private columnsSubject = new BehaviorSubject<{ name: string; type: string }[]>([]);
  columns$ = this.columnsSubject.asObservable();

  constructor(private fb: FormBuilder) {
    this.buildForm();
    this.setupObservables();
    // Clear axes fields when chart type does NOT need axes
  this.chartType$.subscribe(chartType => {
    if (!this.chartNeedsAxes(chartType)) {
      const xControl = this.form.get('x_column');
      const yControl = this.form.get('y_column');
      if (xControl && xControl.value !== null) {
        xControl.setValue(null, { emitEvent: false });
      }
      if (yControl && yControl.value !== null) {
        yControl.setValue(null, { emitEvent: false });
      }
    }
  });
 
  }


  private buildForm(): void {
    this.form = this.fb.group({
      // Step 1: Dataset selection
      dataset_id: [null, Validators.required],
      // Step 2: Chart type & axes
      chart_type: [null, Validators.required],
      x_column: [null],
      y_column: [null],
      // Step 3: Filters (optional)
      filters: this.fb.array([]),
      // Step 4: Aggregation (optional)
      group_by: [[]],
      agg_func: [null],
      value_col: [null],
      // Step 5: Title & advanced
      title: ['', [Validators.required, Validators.minLength(3)]],
      missing_config: [null],
      color_scheme: ['default']
    }, { validators: [this.aggregationValidator, this.axesValidator] });
  }

  private setupObservables(): void {
    this.datasetId$ = this.form.get('dataset_id')!.valueChanges.pipe(
      distinctUntilChanged()
    );
    this.chartType$ = this.form.get('chart_type')!.valueChanges.pipe(
      distinctUntilChanged()
    );

    this.step1Valid$ = this.form.get('dataset_id')!.statusChanges.pipe(
      map(() => this.form.get('dataset_id')!.valid)
    );
    this.step2Valid$ = this.form.statusChanges.pipe(
      map(() => {
        const chart = this.form.get('chart_type');
        if (!chart?.valid) return false;
        // If chart type needs axes, ensure those are valid
        const needsAxes = this.chartNeedsAxes(chart.value);
        if (needsAxes) {
          return this.form.get('x_column')!.valid && this.form.get('y_column')!.valid;
        }
        return true;
      })
    );
    this.step3Valid$ = this.form.get('filters')!.statusChanges.pipe(
      map(() => this.form.get('filters')!.valid)
    );
    this.step4Valid$ = this.form.statusChanges.pipe(
      map(() => {
        // Aggregation step is valid if the custom aggregation validator doesn't have errors
        const aggErrors = this.form.errors?.['aggregation'];
        return !aggErrors;
      })
    );
    this.step5Valid$ = this.form.get('title')!.statusChanges.pipe(
      map(() => this.form.get('title')!.valid)
    );
  }

  // ---- Validators ----

  /**
   * Custom validator: group_by, agg_func, value_col must all be provided together,
   * or all must be absent (null/[]). Exactly matches backend Pydantic validator.
   */
  private aggregationValidator = (group: AbstractControl): ValidationErrors | null => {
  const groupBy = group.get('group_by')?.value || [];
  const aggFunc = group.get('agg_func')?.value;
  const valueCol = group.get('value_col')?.value;

  const isAggregationUsed = aggFunc || (groupBy.length > 0) || valueCol;
  if (isAggregationUsed) {
    const errors: any = {};
    if (!aggFunc) errors['aggFuncRequired'] = true;
    if (groupBy.length === 0) errors['groupByRequired'] = true;
    if (!valueCol) errors['valueColRequired'] = true;
    if (Object.keys(errors).length) return { aggregation: errors };
  }
  return null;
}

  /**
   * Axes validator: x_column and y_column required for charts that use them.
   */
  private axesValidator = (group: AbstractControl): ValidationErrors | null => {
  const chartType = group.get('chart_type')?.value;
  if (this.chartNeedsAxes(chartType)) {
    const x = group.get('x_column')?.value;
    const y = group.get('y_column')?.value;
    const errors: any = {};
    if (!x) errors['xRequired'] = true;
    if (!y) errors['yRequired'] = true;
    return Object.keys(errors).length ? { axes: errors } : null;
  }
  return null;

}

  chartNeedsAxes(chartType: ChartType | null): boolean {
    return chartType ? !['pie', 'kpi'].includes(chartType) : false;
  }

  // ---- Filters FormArray helpers ----
  get filtersArray(): FormArray {
    return this.form.get('filters') as FormArray;
  }

  addFilter(): void {
    const filterGroup = this.fb.group({
      column: [null, Validators.required],
      operator: ['==', Validators.required],
      value: [null, Validators.required]
    });
    this.filtersArray.push(filterGroup);
  }

  removeFilter(index: number): void {
    this.filtersArray.removeAt(index);
  }

  // ---- Column metadata ----
  setColumns(columns: { name: string; type: string }[]): void {
    this.columnsSubject.next(columns);
  }

  // ---- Build final payload ----
  /**
   * Returns a DashboardConfig object that exactly matches the schema.
   * Handles optional fields, nulls, and aggregation clearing.
   */
  buildConfig(): any {
    const raw = this.form.getRawValue();
    const config: any = {
      dataset_id: raw.dataset_id,
      chart_type: raw.chart_type,
      title: raw.title
    };

    // Axes
    if (this.chartNeedsAxes(raw.chart_type)) {
      config.x_column = raw.x_column;
      config.y_column = raw.y_column;
    }

    // Filters (omit if empty)
    if (raw.filters && raw.filters.length > 0) {
      config.filters = raw.filters;
    }

    // Aggregation (all or nothing)
    const isAggregation = raw.agg_func || (raw.group_by && raw.group_by.length > 0) || raw.value_col;
    if (isAggregation) {
      config.group_by = raw.group_by;
      config.agg_func = raw.agg_func;
      config.value_col = raw.value_col;
    }

    // Missing config (only if not null)
    if (raw.missing_config) {
      config.missing_config = raw.missing_config;
    }

    // Color scheme
    if (raw.color_scheme && raw.color_scheme !== 'default') {
      config.color_scheme = raw.color_scheme;
    }

    return config;
  }

  /**
   * Map backend 422 error details to form controls.
   */
  mapBackendErrors(details: any[]): void {
    details.forEach((err: any) => {
      // err.loc example: ["body", "config", "filters", 0, "operator"]
      const path = err.loc.slice(2); // remove 'body', 'config'
      const controlPath = path.map((seg: any) =>
        typeof seg === 'number' ? seg : seg
      ).join('.');
      const control = this.form.get(controlPath);
      if (control) {
        control.setErrors({ backend: err.msg });
        control.markAsTouched();
      } else {
        // If path not found, set a general form error
        this.form.setErrors({ backend: err.msg });
      }
    });
  }
  
}