import type { ReactNode } from "react";

// ─── Tipos de gráfico suportados ───────────────────────────────────────────────
export type ChartType =
  | "bar"
  | "line"
  | "scatter"
  | "pie"
  | "area"
  | "histogram"
  | "column"
  | "map"
  | "heatmap"
  | "treemap"
  | "indicador"
  | "pareto"
  | "pivottable"
  | "kpi"
  | "table"
  | "radar";

// ─── Primitive value type for chart data cells ──────────────────────────────
export type DataValue = string | number | boolean | null | undefined;

/** Safely convert a DataValue to string without triggering Object.toString lint errors */
export function strVal(v: DataValue): string {
  if (v == null) return '';
  return String(v as string | number | boolean);
}

// ─── Props passadas para cada modelo ao renderizar ────────────────────────────
export interface ChartRenderProps {
  data: Array<Record<string, DataValue>>;
  xField: string;
  yField: string;
  columns: string[];
  colors: string[];
  title?: string;
}

// ─── Interface base de um modelo de gráfico ───────────────────────────────────
export interface ChartModel {
  type: ChartType;
  label: string;
  description: string;
  icon: string;         // emoji visual
  minColumns: number;   // mínimo de colunas necessárias
  render: (props: ChartRenderProps) => ReactNode;
}

// ─── Normaliza nomes vindos do backend para ChartType ─────────────────────────
export function normalizeChartType(backendName: string): ChartType {
  const normalized = backendName.toLowerCase().trim();

  const map: Record<string, ChartType> = {
    bar: "bar",
    line: "line",
    scatter: "scatter",
    pie: "pie",
    area: "area",
    histograma: "histogram",
    histogram: "histogram",
    column: "column",
    map: "map",
    heatmap: "heatmap",
    treemap: "treemap",
    indicador: "indicador",
    "gráfico de pareto": "pareto",
    "grafico de pareto": "pareto",
    pareto: "pareto",
    "pivot tables": "pivottable",
    pivottable: "pivottable",
    pivot: "pivottable",
    kpi: "kpi",
    table: "table",
    radar: "radar",
  };

  return map[normalized] ?? "bar";
}
