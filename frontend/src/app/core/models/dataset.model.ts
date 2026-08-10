// src/app/core/models/dataset.model.ts

export interface ColumnSchema {
  name: string;
  type: 'number' | 'date' | 'text';
}

export type DatasetStatus = 'UPLOADED' | 'REFINING' | 'REFINED' | 'ERROR';

export type SourceType = 'csv' | 'excel' | 'mysql';

export interface DatasetOut {
  id: number;
  filename: string;
  source_type: SourceType;               // now required, matches backend
  row_count: number | null;
  col_count: number | null;
  column_schema: ColumnSchema[] | null;
  uploaded_at: string;
  source_path?: string | null;
  status: DatasetStatus;                 // new – replaces derived is_refined
  model_id?: number | null;              // new – auto‑created model ID (from upload)
  refined_column_schema?: ColumnSchema[] | null;

 // ---------- MySQL specific ----------
  connection_id?: number;        // reference to MySQLConnection
  source_table?: string;         // original table name (if imported via static import)
// Derived convenience property (added by mapper)
  is_refined: boolean;
}

export function mapDatasetOut(raw: any): DatasetOut {
  return { ...raw, is_refined: raw.status === 'REFINED' };
}

export interface DatasetPreview {
  cached: boolean;
  data: any[];   // array of objects
  status: DatasetStatus;

}

//header config
export interface ConfigureHeaderRequest {
  header_row: number;
  skip_rows?: number[];
  column_names?: { [original: string]: string };
}

export interface RawPreviewResponse {
  columns: string[];
  rows: any[];
  total_rows_estimate: number;
}

//paginated response
export interface PaginatedResponse {
  items: DatasetOut[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface PaginationInfo {
  page: number;
  size: number;
  total: number;
  pages: number;
}