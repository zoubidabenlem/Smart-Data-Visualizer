export interface FilterCondition {
  column: string;
  operator: '>' | '<' | '==' | '!=' | 'in' | 'like';
  value: any;
}

export interface MissingOverride {
  strategy: 'drop' | 'fill' | 'mean';
  fill_value?: any;
}

export interface MissingConfig {
  default: 'drop' | 'fill' | 'mean';
  overrides?: { [column: string]: string | MissingOverride };
}

export type ChartType = 'bar' | 'line' | 'scatter' | 'pie' | 'area' | 'heatmap' | 'kpi';
export type AggFunc = 'SUM' | 'MEAN' | 'COUNT';

export interface DashboardConfig {
  dataset_id: number;
  chart_type: ChartType;
  title: string;
  x_column?: string | null;
  y_column?: string | null;
  filters?: FilterCondition[];
  group_by?: string[] | null;
  agg_func?: AggFunc | null;
  value_col?: string | null;
  missing_config?: MissingConfig | null;
  color_scheme?: string;
}