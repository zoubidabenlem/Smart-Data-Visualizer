// src/app/core/models/refine.model.ts

export type RefineActionType = 'rename' | 'drop' | 'missing' | 'deduplicate' | 'merge' | 'cast';  // Added 'cast' action type
export type AllowedDtype = 'float' | 'int' | 'datetime' | 'string';
export type MissingStrategy = 'drop' | 'fill' | 'mean';
export type DedupKeep = 'first' | 'last' | false;

export interface MergeParameters {
  source_columns: string[];   // current column names
  target_column: string;      // new merged column name
  separator?: string;         // default " "
  drop_sources?: boolean;     // default true
}

export interface ColumnRefineAction {
  action: RefineActionType;
  original_name?: string | null;         // required for rename/drop/missing/cast
  new_name?: string | null;              // required for rename
  override_dtype?: AllowedDtype | null;  // optional type conversion after rename
  missing_strategy?: MissingStrategy | null;
  missing_fill_value?: string | null;
  subset?: string[] | null;              // for deduplicate
  keep?: DedupKeep | null;
  parameters?: MergeParameters | null;   // for merge
}

export interface RefinedColumnInfo {
  name: string;
  dtype: string;
}

export interface SandboxPreviewResponse {
  preview: any[];                  // array of row objects
  columns: RefinedColumnInfo[];    // current schema
  actions: ColumnRefineAction[];   // full sandbox recipe
}