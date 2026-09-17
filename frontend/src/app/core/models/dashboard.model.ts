// src/app/core/models/dashboard.model.ts

// ----------------------------------------------------------------------
// Dashboard page models
// ----------------------------------------------------------------------
export interface DashboardPage {
  id: number;
  title: string;
  order: number;
}

export interface DashboardPageCreateRequest {
  title?: string;
}

export interface DashboardPageUpdateRequest {
  title?: string;
  order?: number;
}
// ----------------------------------------------------------------------
// Widget Configuration (mirrors backend WidgetConfig)
// ----------------------------------------------------------------------

export type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'scatter'
  | 'area'
  | 'heatmap'
  | 'kpi';

export type Aggregation = 'SUM' | 'MEAN' | 'COUNT' | 'MIN' | 'MAX';
export type SortDirection = 'asc' | 'desc';

export interface ColumnRef {
  dataset_id: number;
  column: string;
}

export interface MeasureSpec {
  dataset_id: number;
  column: string;
  aggregation: Aggregation;
  alias?: string | null; // required when more than one measure
}

export interface OrderByClause {
  field: string;      // original field name (maybe dataset-qualified?)
  alias: string;      // alias used in the select
  direction: SortDirection;
}

// Filter condition – should match backend ModelFilterCondition
// If you already have a definition, import it from the appropriate file.
export interface ModelFilterCondition {
  dataset_id: number;
  column: string;
  operator: '==' | '!=' | '>' | '<' | 'in' | 'like';
  value: any;
}
export interface MissingConfig {
  default: 'drop' | 'fill' | 'mean';
  default_fill_value?: string | number | null;
  overrides?: Record<string, string | MissingOverride>; // string = strategy, or an object
}
export interface MissingOverride {
  strategy: 'drop' | 'fill' | 'mean';
  fill_value?: string | number | null;
}

export interface WidgetConfig {
  model_id: number;
  chart_type: ChartType;
  title: string;

  dimensions: ColumnRef[];
  measures: MeasureSpec[];

  filters: ModelFilterCondition[];
  order_by: OrderByClause[];
  limit?: number | null;

  color_scheme: string;
  missing_config?: MissingConfig | null;
}

// ----------------------------------------------------------------------
// Widget Position
// ----------------------------------------------------------------------

export interface WidgetPosition {
  x: number;
  y: number;
  cols: number;
  rows: number;
}

// ----------------------------------------------------------------------
// API Request / Response models
// ----------------------------------------------------------------------

export interface DashboardCreateRequest {
  title: string;
  model_id?: number | null;        //  NEW
  widgets?: WidgetConfig[] | null; // optional initial widgets
}

export interface DashboardCreateResponse {
  id: number;
}

export interface DashboardUpdateRequest {
  title?: string | null;
  model_id?: number | null;        // settable only when currently null

}

export interface WidgetCreateRequest {
  config: WidgetConfig;
  position?: WidgetPosition | null;
  page_id?: number | null;    //  NEW
}


export interface WidgetUpdateRequest {
  config?: WidgetConfig | null;
  position?: WidgetPosition | null;
}

export interface WidgetResponse {
  id: number;
  page_id: number | null;     // NEW
  config: WidgetConfig;
  chart_data: any[];
  position?: WidgetPosition | null;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardResponse {
  id: number;
  title: string;
  model_id?: number | null;  // NEW
  pages: DashboardPage[];     //  NEW
  widgets: WidgetResponse[];
  created_at: string;
  updated_at: string;
}

export interface DashboardListItem {
  id: number;
  title: string;
  model_id: number | null;
  model_name: string | null;
  created_at: string;
  widget_count: number;
}

export interface DashboardPaginatedResponse {
  items: DashboardListItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
export interface WidgetPositionUpdate {
  x: number;
  y: number;
  cols: number;
  rows: number;
}

export interface FilterDatasetOption {
  id: number;
  name: string;
  columns: { name: string; type: string }[];
}

export interface DashboardFilterDataset {
  dataset_id: number;
  alias: string | null;
  name: string;
  columns: { name: string; type: string }[];
}

export interface DashboardFilterContext {
  model_id: number | null;
  datasets: DashboardFilterDataset[];
}