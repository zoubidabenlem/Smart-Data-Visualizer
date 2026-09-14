import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { DataModelService } from 'src/app/core/services/data-model.service';
import { DataModelOut } from 'src/app/core/models/data-model.model';
import { ColumnSchema, DatasetOut } from 'src/app/core/models/dataset.model';

@Component({
  selector: 'app-data-model-explorer',
  templateUrl: './data-model-explorer.component.html',
  styleUrls: ['./data-model-explorer.component.css'],
})
export class DataModelExplorerComponent implements OnInit, OnDestroy {
  @Input() collapsed = false;
  @Input() locked = false;            // NEW
  @Output() modelSelected = new EventEmitter<DataModelOut>();
  @Output() collapsedChange = new EventEmitter<boolean>();

  models: DataModelOut[] = [];
  filteredModels: DataModelOut[] = [];
  selectedModel: DataModelOut | null = null;

  searchTerm = '';
  loading = false;
  errorMessage = '';

  isModelListCollapsed = false;
  isDetailsCollapsed = false;

  expandedDatasets: { [datasetId: number]: boolean } = {};
  expandedRelationships = false;

  private destroy$ = new Subject<void>();

  constructor(private modelService: DataModelService) {}

  ngOnInit(): void {
    this.loadModels();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadModels(): void {
    this.loading = true;
    this.errorMessage = '';
    this.modelService
      .getModels(1, 5)
      .pipe(takeUntil(this.destroy$), finalize(() => (this.loading = false)))
      .subscribe({
        next: (paginated) => {
          this.models = paginated.models;
          this.applyFilter();
        },
        error: (err) => {
          this.errorMessage = 'Failed to load models. Please try again.';
          console.error('DataModelExplorer error:', err);
        },
      });
  }
    get isReadOnly(): boolean {
    return this.locked;
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
    this.applyFilter();
  }

  private applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredModels = [...this.models];
    } else {
      this.filteredModels = this.models.filter(
        (m) =>
          m.name.toLowerCase().includes(term) ||
          (m.description?.toLowerCase().includes(term) ?? false)
      );
    }
  }
  onSearchInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  this.onSearchChange(input.value);
}

getDatasetName(dataset: DatasetOut): string {
  return dataset.source_table || dataset.filename || `Dataset ${dataset.id}`;
}

getDatasetColumns(dataset: DatasetOut): ColumnSchema[] {
  return dataset.refined_column_schema || dataset.column_schema || [];
}

selectModel(model: DataModelOut): void {
  if (this.locked) {
    return;   // silently ignore; the UI shows the lock banner
  }
  this.selectedModel = model;
  this.expandedDatasets = {};
  if (model.datasets.length) {
    this.expandedDatasets[model.datasets[0].dataset_id] = true;
  }
  this.expandedRelationships = false;
  this.isModelListCollapsed = true;
  this.modelSelected.emit(model);
  }

  toggleDataset(datasetId: number): void {
    this.expandedDatasets[datasetId] = !this.expandedDatasets[datasetId];
  }

  toggleRelationships(): void {
    this.expandedRelationships = !this.expandedRelationships;
  }

  toggleModelList(): void {
    this.isModelListCollapsed = !this.isModelListCollapsed;
  }

  toggleDetails(): void {
    this.isDetailsCollapsed = !this.isDetailsCollapsed;
  }

  toggleOverallCollapse(): void {
    this.collapsed = !this.collapsed;
    this.collapsedChange.emit(this.collapsed);
  }

  getColumnType(col: ColumnSchema): string {
    return (col as any).dtype || (col as any).type || (col as any).data_type || (col as any).column_type || 'unknown';
  }
}