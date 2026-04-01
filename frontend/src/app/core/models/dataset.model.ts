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
  created_at: string;   // or uploaded_at, adjust based on backend
}

export interface DatasetPreview {
  cached: boolean;
  data: any[];   // array of objects
}