// src/app/core/models/dataset.model.ts

export interface ColumnSchema {
  name: string;
  type: 'number' | 'date' | 'text';
}

export interface DatasetOut {
  id: number;
  filename: string;
  row_count: number;
  col_count: number;
  column_schema: ColumnSchema[];
  uploaded_at: string;          // matches backend field name
  is_refined: boolean;          // ← required for guard
  refined_column_schema?: ColumnSchema[];  // optional, present if refined // or uploaded_at, adjust based on backend
 
}

export interface DatasetPreview {
  cached: boolean;
  data: any[];   // array of objects
  refined?: boolean;

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