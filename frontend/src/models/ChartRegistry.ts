import type { ChartModel, ChartType } from "@/types/chart";

import { BarChartModel } from "./charts/BarChartModel";
import { LineChartModel } from "./charts/LineChartModel";
import { ScatterChartModel } from "./charts/ScatterChartModel";
import { PieChartModel } from "./charts/PieChartModel";
import { AreaChartModel } from "./charts/AreaChartModel";
import { HistogramChartModel } from "./charts/HistogramChartModel";
import { ColumnChartModel } from "./charts/ColumnChartModel";
import { MapChartModel } from "./charts/MapChartModel";
import { HeatmapChartModel } from "./charts/HeatmapChartModel";
import { TreeMapChartModel } from "./charts/TreeMapChartModel";
import { IndicadorChartModel } from "./charts/IndicadorChartModel";
import { ParetoChartModel } from "./charts/ParetoChartModel";
import { PivotTableChartModel } from "./charts/PivotTableChartModel";
import { KPIChartModel } from "./charts/KPIChartModel";
import { RadarChartModel } from "./charts/RadarChartModel";

/** Todos os modelos registrados */
export const CHART_REGISTRY: Record<ChartType, ChartModel> = {
  bar:        BarChartModel,
  line:       LineChartModel,
  scatter:    ScatterChartModel,
  pie:        PieChartModel,
  area:       AreaChartModel,
  histogram:  HistogramChartModel,
  column:     ColumnChartModel,
  map:        MapChartModel,
  heatmap:    HeatmapChartModel,
  treemap:    TreeMapChartModel,
  indicador:  IndicadorChartModel,
  pareto:     ParetoChartModel,
  pivottable: PivotTableChartModel,
  kpi:        KPIChartModel,
  radar:      RadarChartModel,
};

/** Retorna o modelo para um tipo, com fallback para bar */
export function getChartModel(type: ChartType): ChartModel {
  return CHART_REGISTRY[type] ?? CHART_REGISTRY.bar;
}

/** Lista de todos os modelos para UI de seleção */
export const ALL_CHART_MODELS: ChartModel[] = Object.values(CHART_REGISTRY);
