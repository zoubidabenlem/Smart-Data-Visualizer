// src/app/features/dashboards/components/model-picker/model-picker.component.ts
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { DataModelService } from 'src/app/core/services/data-model.service';
import { DataModelOut } from 'src/app/core/models/data-model.model';

@Component({
  selector: 'app-model-picker',
  templateUrl: './model-picker.component.html',
  styleUrls: ['./model-picker.component.css'],
})
export class ModelPickerComponent implements OnChanges {
  /** The dashboard's bound model id (from dashboard.model_id). */
  @Input() boundModelId: number | null = null;

  /** The editor's currently-loaded DataModelOut (may match the bound one, or be a pending pick). */
  @Input() currentModel: DataModelOut | null = null;

  @Output() modelSelected = new EventEmitter<DataModelOut>();

  collapsed = false;
  listExpanded = false;

  loading = false;
  errorMessage = '';
  searchTerm = '';

  allModels: DataModelOut[] = [];
  filteredModels: DataModelOut[] = [];

  constructor(private modelService: DataModelService) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Whenever the dashboard binds a model, close the picker list.
    if (changes['boundModelId'] && this.boundModelId != null) {
      this.listExpanded = false;
    }
  }

  get isLocked(): boolean {
    return this.boundModelId != null;
  }

  get displayName(): string {
    if (this.currentModel?.name) return this.currentModel.name;
    if (this.boundModelId != null) return `Model #${this.boundModelId}`;
    return '';
  }

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
  }

  toggleList(): void {
    if (this.isLocked) return;
    this.listExpanded = !this.listExpanded;
    if (this.listExpanded && this.allModels.length === 0) {
      this.fetchModels();
    }
  }

  pickModel(model: DataModelOut): void {
    if (this.isLocked) return;
    this.listExpanded = false;
    this.modelSelected.emit(model);
  }

  onSearch(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value ?? '';
    this.applyFilter();
  }

  private fetchModels(): void {
    this.loading = true;
    this.errorMessage = '';
    this.modelService.getModels(1, 100).subscribe({
      next: (page) => {
        this.allModels = page.models;
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        console.error('[ModelPicker] fetch failed', err);
        this.errorMessage = 'Failed to load models.';
        this.loading = false;
      },
    });
  }

  private applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredModels = [...this.allModels];
      return;
    }
    this.filteredModels = this.allModels.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        (m.description?.toLowerCase().includes(term) ?? false)
    );
  }
}