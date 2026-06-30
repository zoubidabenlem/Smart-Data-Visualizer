import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RefineService } from 'src/app/core/services/refine.service';
import { DatasetService } from 'src/app/core/services/dataset.service';
import {
  ColumnRefineAction,
  RefineActionType,
  SandboxPreviewResponse,
  RefinedColumnInfo,
  MergeParameters,
  AllowedDtype,
  MissingStrategy,
  DedupKeep
} from 'src/app/core/models/refine.model';

@Component({
  selector: 'app-refine-sandbox',
  templateUrl: './refine-sandbox.component.html',
  styleUrls: ['./refine-sandbox.component.css']
})
export class RefineSandboxComponent implements OnInit {
  datasetId!: number;
  datasetInfo: { filename: string; rowCount: number; colCount: number } | null = null;
  previewRows: any[] = [];
  columns: RefinedColumnInfo[] = [];
  actions: ColumnRefineAction[] = [];
  loading = false;
  error = '';

  // Form for the action being configured
  actionForm: FormGroup;
  selectedActionType: RefineActionType = 'rename';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private refineService: RefineService,
    private datasetService: DatasetService
  ) {
    this.actionForm = this.fb.group({
      original_name: [null],
      new_name: [null],
      override_dtype: [null],
      missing_strategy: [null],
      missing_fill_value: [null],
      subset: [null],
      keep: [null],
      // merge parameters nested group
      merge_source_columns: [[]],
      merge_target_column: [null],
      merge_separator: [' '],
      merge_drop_sources: [true]
    });
  }

  ngOnInit(): void {
    this.datasetId = +this.route.snapshot.paramMap.get('datasetId')!;
    this.loadInitialData();
  }

  private loadInitialData(): void {
    this.loading = true;
    // Fetch dataset info (filename, row/col counts)
    this.datasetService.getDataset(this.datasetId).subscribe({
      next: (dataset) => {
        this.datasetInfo = {
          filename: dataset.filename,
          rowCount: dataset.row_count,
          colCount: dataset.col_count
        };
        // Fetch the initial preview (raw data, no actions applied yet)
        this.loadPreview();
      },
      error: (err) => {
        this.error = 'Failed to load dataset info.';
        this.loading = false;
      }
    });
  }

  private loadPreview(): void {
    this.datasetService.getPreview(this.datasetId).subscribe({
      next: (preview) => {
        // preview.data is array of row objects
        this.previewRows = preview.data;
        if (preview.data.length > 0) {
          // Infer columns from first row (or use dataset info)
          const firstRow = preview.data[0];
          this.columns = Object.keys(firstRow).map(key => ({
            name: key,
            dtype: typeof firstRow[key] === 'number' ? 'float64' : 'object'
          }));
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.detail || 'Failed to load preview';
        this.loading = false;
      }
    });
  }

  // Called when user selects a different action type
  onActionTypeChange(type: RefineActionType): void {
    this.selectedActionType = type;
    // Reset relevant fields
    this.actionForm.reset({
      merge_separator: ' ',
      merge_drop_sources: true
    });
  }

  // Build the payload from form values and the selected action type
  private buildActionFromForm(): ColumnRefineAction {
    const formValue = this.actionForm.value;
    const action: ColumnRefineAction = {
      action: this.selectedActionType
    };

    switch (this.selectedActionType) {
      case 'rename':
        action.original_name = formValue.original_name;
        action.new_name = formValue.new_name;
        action.override_dtype = formValue.override_dtype || null;
        break;
      case 'drop':
        action.original_name = formValue.original_name;
        break;
      case 'missing':
        action.original_name = formValue.original_name;
        action.missing_strategy = formValue.missing_strategy;
        action.missing_fill_value = formValue.missing_fill_value || null;
        action.override_dtype = formValue.override_dtype || null;
        break;
      case 'deduplicate':
        action.subset = formValue.subset;
        action.keep = formValue.keep;
        break;
      case 'merge':
        action.parameters = {
          source_columns: formValue.merge_source_columns,
          target_column: formValue.merge_target_column,
          separator: formValue.merge_separator,
          drop_sources: formValue.merge_drop_sources
        };
        break;
    }
    return action;
  }

  // Validate the form before applying
  isFormValid(): boolean {
    // Basic validation based on action type
    switch (this.selectedActionType) {
      case 'rename':
        return !!this.actionForm.get('original_name')?.value ;
      case 'drop':
        return !!this.actionForm.get('original_name')?.value;
      case 'missing':
        return !!this.actionForm.get('original_name')?.value && !!this.actionForm.get('missing_strategy')?.value;
      case 'deduplicate':
        const subset = this.actionForm.get('subset')?.value;
        return subset && subset.length > 0 && !!this.actionForm.get('keep')?.value;
      case 'merge':
        const sources = this.actionForm.get('merge_source_columns')?.value;
        return sources && sources.length >= 2 && !!this.actionForm.get('merge_target_column')?.value;
      default:
        return false;
    }
  }

  applyAction(): void {
    if (!this.isFormValid()) {
      this.error = 'Please fill in all required fields.';
      return;
    }
    const action = this.buildActionFromForm();
    this.loading = true;
    this.error = '';
    this.refineService.applyAction(this.datasetId, action).subscribe({
      next: (response: SandboxPreviewResponse) => {
        this.updateStateFromResponse(response);
        this.loading = false;
        this.actionForm.reset({ merge_separator: ' ', merge_drop_sources: true });
      },
      error: (err) => {
        this.error = err.error?.detail || 'Action failed';
        this.loading = false;
      }
    });
  }

  undoLastAction(): void {
    this.loading = true;
    this.error = '';
    this.refineService.undoAction(this.datasetId).subscribe({
      next: (response: SandboxPreviewResponse) => {
        this.updateStateFromResponse(response);
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.detail || 'Undo failed';
        this.loading = false;
      }
    });
  }

  finalize(): void {
    if (this.actions.length === 0) {
      this.error = 'No actions to finalize.';
      return;
    }
    if (!confirm('Finalize the dataset? This will apply all actions permanently.')) return;
    this.loading = true;
    this.error = '';
    this.refineService.finalize(this.datasetId).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboards']); // or wherever appropriate
      },
      error: (err) => {
        this.error = err.error?.detail || 'Finalize failed';
        this.loading = false;
      }
    });
  }

  private updateStateFromResponse(response: SandboxPreviewResponse): void {
    this.previewRows = response.preview;
    this.columns = response.columns;
    this.actions = response.actions;
  }

  // Helper to generate a readable description of an action
  describeAction(action: ColumnRefineAction): string {
    switch (action.action) {
      case 'rename': return `Rename ${action.original_name} → ${action.new_name}`;
      case 'drop': return `Drop ${action.original_name}`;
      case 'missing': return `Handle missing in ${action.original_name} (${action.missing_strategy})`;
      case 'deduplicate': return `Deduplicate on [${action.subset?.join(', ')}]`;
      case 'merge': return `Merge [${action.parameters?.source_columns.join(', ')}] → ${action.parameters?.target_column}`;
      default: return 'Unknown action';
    }
  }
}