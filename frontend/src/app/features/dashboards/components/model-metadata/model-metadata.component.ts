// src/app/features/dashboards/components/model-metadata/model-metadata.component.ts
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { DataModelOut } from 'src/app/core/models/data-model.model';
import { ColumnSchema, DatasetOut } from 'src/app/core/models/dataset.model';

/** Stable empty array so *ngFor never sees a new reference. */
const EMPTY_COLUMNS: ColumnSchema[] = [];

@Component({
  selector: 'app-model-metadata',
  templateUrl: './model-metadata.component.html',
  styleUrls: ['./model-metadata.component.css'],
})
export class ModelMetadataComponent implements OnChanges {
  @Input() model: DataModelOut | null = null;

  collapsed = false;
  relationshipsExpanded = false;
  expandedDatasets = new Set<number>();

  /** Precomputed once per `model` change. Template reads ONLY from these. */
  columnsByDatasetId = new Map<number, ColumnSchema[]>();
  datasetNameById = new Map<number, string>();

    // ─── trackBy: keeps DOM stable across CD cycles ───

  trackByDatasetId = (_: number, md: any): number => md.dataset_id;
  trackByColumnName = (_: number, col: ColumnSchema): string => col.name;
  trackByRelId = (_: number, rel: any): number => rel.id;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['model']) {
      this.rebuildCaches();
    }
  }

  // ─── Cache build ───

  private rebuildCaches(): void {
    this.columnsByDatasetId.clear();
    this.datasetNameById.clear();

    const m = this.model;
    if (!m) return;

    for (const md of m.datasets) {
      this.datasetNameById.set(md.dataset_id, this.computeDatasetLabel(md));
      this.columnsByDatasetId.set(
        md.dataset_id,
        this.extractColumns(md.dataset)
      );
    }

    // If the model changed, reset expansion to avoid leaking state.
    this.expandedDatasets.clear();
    this.relationshipsExpanded = false;
  }

  // ─── Template-safe accessors (no allocation) ───

  columns(datasetId: number): ColumnSchema[] {
    return this.columnsByDatasetId.get(datasetId) ?? EMPTY_COLUMNS;
  }

  columnCount(datasetId: number): number {
    return this.columnsByDatasetId.get(datasetId)?.length ?? 0;
  }

  nameForDataset(datasetId: number): string {
    return this.datasetNameById.get(datasetId) ?? `#${datasetId}`;
  }

  datasetLabel(md: any): string {
    return this.computeDatasetLabel(md);
  }

  isExpanded(datasetId: number): boolean {
    return this.expandedDatasets.has(datasetId);
  }

  // ─── Interaction ───

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
  }

  toggleDataset(datasetId: number): void {
    if (this.expandedDatasets.has(datasetId)) {
      this.expandedDatasets.delete(datasetId);
    } else {
      this.expandedDatasets.add(datasetId);
    }
  }

  toggleRelationships(): void {
    this.relationshipsExpanded = !this.relationshipsExpanded;
  }

  // ─── Pure helpers (only called during cache build) ───

  private computeDatasetLabel(md: any): string {
    return (
      md?.alias ||
      md?.dataset?.source_table ||
      md?.dataset?.filename ||
      `Dataset ${md?.dataset_id ?? '?'}`
    );
  }

  private extractColumns(dataset: DatasetOut | null | undefined): ColumnSchema[] {
    if (!dataset) return [];
    const raw = (dataset as any).column_schema;
    const refined = (dataset as any).refined_column_schema;
    const source = refined || raw;
    if (!source) return [];

    if (Array.isArray(source)) {
      return source
        .filter((c: any) => c)
        .map(
          (c: any): ColumnSchema =>
            typeof c === 'string'
              ? ({ name: c, type: 'text' } as ColumnSchema)
              : ({
                  name: c.name ?? c.column ?? '?',
                  type: c.type ?? c.dtype ?? c.data_type ?? 'unknown',
                } as ColumnSchema)
        );
    }

    if (typeof source === 'object') {
      return Object.entries(source).map(
        ([name, info]: [string, any]): ColumnSchema => ({
          name,
          type:
            (typeof info === 'object'
              ? info?.type ?? info?.dtype ?? info?.data_type
              : info) ?? 'unknown',
        })
      );
    }
    return [];
  }
}