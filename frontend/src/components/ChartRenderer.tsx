import { useMemo } from "react";
import { getChartModel } from "@/models/ChartRegistry";
import { normalizeChartType } from "@/types/chart";
import type { DataValue } from "@/types/chart";

interface ChartRendererProps {
  /** Tipo de gráfico: aceita string do backend ou ChartType */
  chartType: string;
  data: Array<Record<string, DataValue>>;
  xField: string;
  yField: string;
  /** Colunas a incluir no gráfico. Se omitido, usa todas as chaves do primeiro objeto */
  columns?: string[];
  colors?: string[];
  title?: string;
}

const DEFAULT_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function ChartRenderer({
  chartType,
  data,
  xField,
  yField,
  columns,
  colors = DEFAULT_COLORS,
  title,
}: Readonly<ChartRendererProps>) {
  const normalizedType = useMemo(
    () => normalizeChartType(String(chartType)),
    [chartType]
  );

  const model = useMemo(() => getChartModel(normalizedType), [normalizedType]);

  const resolvedColumns = useMemo(() => {
    if (columns && columns.length > 0) return columns;
    if (data.length > 0) return Object.keys(data[0]);
    return [xField, yField];
  }, [columns, data, xField, yField]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Nenhum dado disponível para renderizar o gráfico.
      </div>
    );
  }

  return (
    <div className="w-full">
      {model.render({
        data,
        xField,
        yField,
        columns: resolvedColumns,
        colors,
        title,
      })}
    </div>
  );
}
