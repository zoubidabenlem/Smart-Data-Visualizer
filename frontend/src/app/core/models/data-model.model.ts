// src/app/core/models/data-model.model.ts

import { DatasetOut } from './dataset.model';


export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

export interface DataModelOut {
  id: number;
  name: string;
  description: string | null;
  user_id: number;
  base_dataset_id: number | null;
  created_at: string;
  datasets: ModelDatasetOut[];
  relationships: TableRelationshipOut[];
}

export interface ModelDatasetOut {
  dataset_id: number;
  alias: string | null;
  dataset: DatasetOut;         // nested full dataset info
}

// Paginated response for model list
export interface PaginatedModelsOut {
  total: number;
  page: number;
  size: number;
  models: DataModelOut[];
}

export interface TableRelationshipOut {
  id: number;
  model_id: number;
  left_dataset_id: number;
  right_dataset_id: number;
  left_column: string;
  right_column: string;
  join_type: JoinType;
  description?: string;
  left_dataset?: DatasetOut;   // optional nested
  right_dataset?: DatasetOut;
}

// --- DTOs for creating / updating ---

export interface DataModelCreateRequest {
  name: string;
  description?: string;
  base_dataset_id?: number;
}

export interface DataModelUpdateRequest {
  name?: string;
  description?: string;
  base_dataset_id?: number;
}

export interface AddDatasetsToModelRequest {
  datasets: { dataset_id: number; alias?: string }[];
}

export interface TableRelationshipCreateRequest {
  left_dataset_id: number;
  right_dataset_id: number;
  left_column: string;
  right_column: string;
  join_type: JoinType;
  description?: string;
}

export interface TableRelationshipUpdateRequest {
  left_dataset_id?: number;
  right_dataset_id?: number;
  left_column?: string;
  right_column?: string;
  join_type?: JoinType;
  description?: string;
}