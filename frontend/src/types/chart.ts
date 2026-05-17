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
  | "radar";

// ─── Primitive value type for chart data cells ──────────────────────────────
export type DataValue = string | number | boolean | null | undefined;

/** Safely convert a DataValue to string without triggering Object.toString lint errors */
export function strVal(v: DataValue): string {
  if (v == null) return '';
  return String(v as string | number | boolean);
}

/**
 * Format a number for chart axis / tooltip display.
 * Uses pt-BR locale with compact notation for large values.
 * Accepts `unknown` so it can be passed directly as a Recharts tickFormatter.
 */
export function fmtNum(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? '');
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000)
    return `${(n / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}B`;
  if (abs >= 1_000_000)
    return `${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
  if (abs >= 10_000)
    return `${(n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}K`;
  if (!Number.isInteger(n))
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return n.toLocaleString('pt-BR');
}

// ─── Props passadas para cada modelo ao renderizar ────────────────────────────
export interface ChartRenderProps {
  data: Array<Record<string, DataValue>>;
  xField: string;
  yField: string;
  columns: string[];
  colors: string[];
  title?: string;
  /** Drill-down: called with the X-axis value when the user clicks a data point */
  onDataPointClick?: (value: string | number) => void;
}

// ─── Interface base de um modelo de gráfico ───────────────────────────────────
export interface ChartModel {
  type: ChartType;
  label: string;
  description: string;
  icon: string;         // emoji visual
  minColumns: number;   // mínimo de colunas necessárias
  /** Cardinality constraints for the X-axis (distinct category count after aggregation) */
  cardinality?: {
    /** Minimum distinct groups needed for this chart to be meaningful */
    min?: number;
    /** Maximum distinct groups before the chart becomes unreadable */
    max?: number;
  };
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
    radar: "radar",
  };

  return map[normalized] ?? "bar";
}
