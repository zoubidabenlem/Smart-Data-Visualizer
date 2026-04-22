import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DatasetService } from '../../../core/services/dataset.service';
import { DatasetOut } from '../../../core/models/dataset.model';

interface ColumnAction {
  original_name: string;
  detected_type: string;
}

@Component({
  selector: 'app-refine-schema',
  templateUrl: './refine-schema.component.html',
  styleUrls: ['./refine-schema.component.css']
})
export class SchemaRefineComponent implements OnInit {
  refineForm!: FormGroup;
  datasetId!: number;
  datasetName: string = '';
  originalColumns: ColumnAction[] = [];
  loading = true;
  submitting = false;
  errorMessage = '';
  refineSuccess = false;
  alreadyRefined = false;        // ← new flag

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private datasetService: DatasetService
  ) {}

  ngOnInit(): void {
    this.datasetId = +this.route.snapshot.paramMap.get('datasetId')!;
    this.checkRefinementStatus();
  }

  checkRefinementStatus(): void {
  this.loading = true;
  console.log('🔍 Checking refinement status for dataset', this.datasetId);
  this.datasetService.getDataset(this.datasetId).subscribe({
    next: (dataset: DatasetOut) => {
      console.log('📦 Dataset fetched:', dataset);
      console.log('📌 is_refined =', dataset.is_refined);
      if (dataset.is_refined) {
        this.alreadyRefined = true;
        this.errorMessage = 'This dataset has already been refined.';
        this.loading = false;
        console.log('✅ alreadyRefined set to true');
        return;
      }
      console.log('➡️ Not refined, loading columns...');
      this.loadColumns();
    },
    error: (err) => {
      console.error('❌ Failed to fetch dataset', err);
      this.errorMessage = 'Could not load dataset information.';
      this.loading = false;
    }
  });
}

loadColumns(): void {
  console.log('📋 Loading columns for dataset', this.datasetId);
  this.datasetService.getDatasetColumns(this.datasetId).subscribe({
    next: (response: any) => {
      console.log('📋 Raw columns response:', response);

      // Extract columns array safely
      let columnsArray = response?.columns;
      if (!Array.isArray(columnsArray)) {
        // Fallback: maybe response itself is the array
        if (Array.isArray(response)) {
          columnsArray = response;
        } else {
          this.errorMessage = 'Invalid columns response format.';
          this.loading = false;
          console.error('Unexpected columns response:', response);
          return;
        }
      }

      if (columnsArray.length === 0) {
        this.errorMessage = 'No columns found in this dataset.';
        this.loading = false;
        return;
      }

      // Map with explicit property checks
      this.originalColumns = columnsArray.map((col: any) => {
        const originalName = col.name ?? col.original_name ?? col.column_name ?? 'unknown';
        const detectedType = col.dtype ?? col.type ?? col.data_type ?? 'string';
        return { original_name: originalName, detected_type: detectedType };
      });

      console.log('📋 Mapped originalColumns:', this.originalColumns);

      this.datasetName = `Dataset ${this.datasetId}`;
      this.buildForm();
      this.loading = false;
      console.log('✅ Form built with', this.columnsArray.length, 'columns');
    },
    error: (err) => {
      console.error('❌ Load columns error:', err);
      this.errorMessage = 'Failed to load column schema.';
      this.loading = false;
    }
  });
}
  buildForm(): void {
    this.refineForm = this.fb.group({
      columns: this.fb.array(this.originalColumns.map(col => this.createColumnGroup(col)))
    });
  }

  createColumnGroup(col: ColumnAction): FormGroup {
    return this.fb.group({
      original_name: [col.original_name],
      detected_type: [col.detected_type],
      action: ['keep', Validators.required],
      new_name: [''],
      override_dtype: ['none']
    });
  }

  get columnsArray(): FormArray {
    return this.refineForm.get('columns') as FormArray;
  }

  isNewNameDuplicate(): boolean {
    const keptNames = this.columnsArray.controls
      .filter(ctrl => ctrl.get('action')?.value === 'keep')
      .map(ctrl => {
        const newName = ctrl.get('new_name')?.value?.trim();
        const originalName = ctrl.get('original_name')?.value;
        return newName ? newName : originalName;
      })
      .map(name => name.toLowerCase());
    return new Set(keptNames).size !== keptNames.length;
  }

  onSubmit(): void {
    if (this.refineForm.invalid || this.isNewNameDuplicate()) {
      this.refineForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    const payload = this.buildPayload();
    this.datasetService.refineSchema(this.datasetId, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.refineSuccess = true;
      },
      error: (err) => {
        this.submitting = false;
        if (err.status === 400 && err.error?.detail?.includes('already refined')) {
          this.alreadyRefined = true;
          this.errorMessage = 'This dataset has already been refined. Please re-upload if you need to change it.';
        } else {
          this.errorMessage = err.error?.detail || 'Refinement failed. Please try again.';
        }
      }
    });
  }

  onSkip(): void {
    this.router.navigate(['/builder/columns', this.datasetId]);
  }

  continueToColumnPicker(): void {
    this.router.navigate(['/builder/columns', this.datasetId]);
  }

  private buildPayload(): any {
    const columnsPayload = this.columnsArray.controls.map(ctrl => {
      const action = ctrl.get('action')?.value;
      const originalName = ctrl.get('original_name')?.value;
      if (action === 'drop') {
        return { original_name: originalName, action: 'drop' };
      } else {
        const newName = ctrl.get('new_name')?.value?.trim();
        const overrideDtype = ctrl.get('override_dtype')?.value;
        return {
          original_name: originalName,
          action: 'keep',
          new_name: newName || originalName,
          override_dtype: overrideDtype !== 'none' ? overrideDtype : undefined
        };
      }
    });
    return { columns: columnsPayload };
  }
}