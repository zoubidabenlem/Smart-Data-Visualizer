import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ModelFilterCondition } from 'src/app/core/models/dashboard.model';

type FilterOperator = ModelFilterCondition['operator'];

interface FilterColumn {
  name: string;
  type: string;
}

interface FilterDataset {
  id: number;
  name: string;
  columns: FilterColumn[];
}

@Component({
  selector: 'app-viewer-filter-chip',
  templateUrl: './viewer-filter-chip.component.html',
  styleUrls: ['./viewer-filter-chip.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerFilterChipComponent {
  @Input() filters: ModelFilterCondition[] = [];
  @Input() open = false;
  @Input() datasets: FilterDataset[] = [];

  @Output() filtersChange = new EventEmitter<ModelFilterCondition[]>();
  @Output() openChange = new EventEmitter<boolean>();

  draftDatasetId: number | null = null;
  draftColumn = '';
  draftOperator: FilterOperator = '==';
  draftValue = '';

  operators: { value: FilterOperator; label: string }[] = [
    { value: '==', label: 'equals' },
    { value: '!=', label: 'not equals' },
    { value: '>', label: 'greater than' },
    { value: '<', label: 'less than' },
    { value: 'in', label: 'in list' },
    { value: 'like', label: 'contains' },
  ];

  // ─── Derived helpers ───

  get availableColumns(): FilterColumn[] {
    if (this.draftDatasetId == null) return [];
    return this.datasets.find((d) => d.id === this.draftDatasetId)?.columns ?? [];
  }

  get valuePlaceholder(): string {
    return this.draftOperator === 'in' ? 'a, b, c' : 'value';
  }

  get canAdd(): boolean {
    return (
      this.draftDatasetId != null &&
      !!this.draftColumn.trim() &&
      !!this.draftValue.trim()
    );
  }

  get isNumericOperator(): boolean {
    return this.draftOperator === '>' || this.draftOperator === '<';
  }

  // ─── Actions ───

  toggleOpen(): void {
    this.openChange.emit(!this.open);
  }

  onDatasetChange(): void {
    this.draftColumn = '';
  }

  add(): void {
    if (!this.canAdd) return;

    const filter: ModelFilterCondition = {
      dataset_id: this.draftDatasetId!,
      column: this.draftColumn.trim(),
      operator: this.draftOperator,
      value: this.parseValue(this.draftValue, this.draftOperator),
    };

    this.filtersChange.emit([...this.filters, filter]);
    this.resetDraft();
  }

  remove(index: number): void {
    this.filtersChange.emit(this.filters.filter((_, i) => i !== index));
  }

  clear(): void {
    if (this.filters.length === 0) return;
    this.filtersChange.emit([]);
  }

  // ─── Display helpers ───

  displayFilter(f: ModelFilterCondition): string {
    const ds = this.datasets.find((d) => d.id === f.dataset_id);
    const dsName = ds?.name ?? `#${f.dataset_id}`;
    const value = Array.isArray(f.value) ? f.value.join(', ') : String(f.value);
    const opLabel = this.operators.find((o) => o.value === f.operator)?.label ?? f.operator;
    return `${dsName}.${f.column} ${opLabel} ${value}`;
  }

  // ─── Internals ───

  private resetDraft(): void {
    this.draftColumn = '';
    this.draftValue = '';
    // keep dataset + operator for fast repeated entry
  }

  private parseValue(raw: string, op: FilterOperator): any {
    const s = raw.trim();
    if (op === 'in') {
      return s.split(',').map((x) => x.trim()).filter((x) => x.length > 0);
    }
    if (op === '>' || op === '<') {
      const n = Number(s);
      return isNaN(n) ? s : n;
    }
    return s;
  }
}