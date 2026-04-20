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
  group_by: string[];        // Campos para agrupar (eixo X / dimensão categórica)
  aggregations: Aggregation[]; // Agregações a aplicar (eixo Y / métrica)
  filters?: Filter[];
  /** Tipo de gráfico — determina a forma do SQL/Pandas gerado no backend.
   *  Se omitido, o backend usa "bar" como padrão e o modelo ML recomenda o ideal. */
  chart_type?: string;
  /** Terceira coluna para tipos bidimensionais (heatmap, pivottable). */
  z_column?: string;
}

export interface QueryExecutionResult {
  data: Array<Record<string, string | number | boolean | null>>;
  columns: string[];
  row_count: number;
}

export interface ChartAlternative {
  chart_type: string;
  probability: number;
}

export interface ChartRecommendation {
  chart_type: string;   // string livre — normalizado pelo frontend via normalizeChartType()
  title: string;
  reason: string;
  x_field: string;
  y_field: string;
  alternatives?: ChartAlternative[];
  configuration?: Record<string, string | number | boolean>;
}

export interface ExecutionResponse {
  query_model: QueryModel;
  result: QueryExecutionResult;
  recommendation: ChartRecommendation;
  execution_time_ms: number;
}
