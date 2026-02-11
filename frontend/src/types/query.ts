/**
 * Tipos para o Query Model seguindo o fluxo:
 * Seleção de Campos + Agregações → Consulta Abstrata → Geração SQL/Pandas → DataFrame → Recomendação
 */

export type SourceType = 'database' | 'file';
export type AggregationFunction = 'sum' | 'avg' | 'count' | 'min' | 'max';

export interface Aggregation {
  field: string;
  func: AggregationFunction;
  alias?: string;
}

export interface Filter {
  field: string;
  operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'like';
  value: string | number | string[];
}

export interface QueryModel {
  source_type: SourceType;
  tables: string[];
  base_table: string;
  group_by: string[]; // Campos para agrupar
  aggregations: Aggregation[]; // Agregações a aplicar
  filters?: Filter[];
}

export interface QueryExecutionResult {
  data: Array<Record<string, string | number | boolean | null>>;
  columns: string[];
  row_count: number;
}

export interface ChartRecommendation {
  chart_type: 'bar' | 'line' | 'scatter' | 'pie' | 'area' | 'histogram';
  title: string;
  reason: string;
  x_field: string;
  y_field: string;
  configuration?: Record<string, string | number | boolean>;
}

export interface ExecutionResponse {
  query_model: QueryModel;
  result: QueryExecutionResult;
  recommendation: ChartRecommendation;
  execution_time_ms: number;
}
