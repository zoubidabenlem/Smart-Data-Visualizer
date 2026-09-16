import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ModelFilterCondition } from 'src/app/core/models/dashboard.model';

type FilterOperator = ModelFilterCondition['operator'];

@Component({
  selector: 'app-viewer-filter-chip',
  templateUrl: './viewer-filter-chip.component.html',
  styleUrls: ['./viewer-filter-chip.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerFilterChipComponent {
  /** Current active filters (owned by the parent, mirrored here for display). */
  @Input() filters: ModelFilterCondition[] = [];

  /** Whether the chip body is visible. */
  @Input() open = false;

  @Output() filtersChange = new EventEmitter<ModelFilterCondition[]>();
  @Output() openChange = new EventEmitter<boolean>();

  // Draft form state — plain fields, no FormGroup needed for 4 inputs.
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

  get valuePlaceholder(): string {
    return this.draftOperator === 'in' ? 'a, b, c' : 'value';
  }

  get canAdd(): boolean {
    return (
      this.draftDatasetId != null &&
      this.draftDatasetId > 0 &&
      !!this.draftColumn.trim() &&
      !!this.draftValue.trim()
    );
  }

  toggleOpen(): void {
    this.openChange.emit(!this.open);
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
    const next = this.filters.filter((_, i) => i !== index);
    this.filtersChange.emit(next);
  }

  clear(): void {
    if (this.filters.length === 0) return;
    this.filtersChange.emit([]);
  }

  private resetDraft(): void {
    this.draftColumn = '';
    this.draftValue = '';
    // keep datasetId and operator for fast repeated entry
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

  displayFilter(f: ModelFilterCondition): string {
    const value = Array.isArray(f.value) ? f.value.join(', ') : String(f.value);
    return `#${f.dataset_id}.${f.column} ${f.operator} ${value}`;
  }
}