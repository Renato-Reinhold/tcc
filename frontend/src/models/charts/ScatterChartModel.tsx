import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Label,
} from "recharts";
import type { ChartModel, ChartRenderProps } from "@/types/chart";
import { fmtNum } from "@/types/chart";

function render({ data, xField, yField, columns, colors }: ChartRenderProps) {
  // Scatter requires numeric axes. If xField is categorical, use the first
  // other numeric column found, or fall back to row index as x.
  const xSample = data[0]?.[xField];
  const xIsNumeric = xSample !== undefined && xSample !== null && !Number.isNaN(Number(xSample));

  // Try to find an alternative numeric column when xField is categorical
  const numericXField = xIsNumeric
    ? xField
    : (columns.find((c) => c !== yField && !Number.isNaN(Number(data[0]?.[c]))) ?? null);

  if (!numericXField) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] gap-3 text-muted-foreground">
        <span className="text-4xl">&#128200;</span>
        <p className="text-sm text-center max-w-xs">
          Dispersão precisa de dois eixos numéricos.
          Selecione colunas numéricas para usar este gráfico.
        </p>
      </div>
    );
  }

  const scatterData = data.map((d) => ({
    x: Number(d[numericXField]) || 0,
    y: Number(d[yField]) || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart margin={{ bottom: 24, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="x" type="number" name={numericXField} tickFormatter={fmtNum}>
          <Label value={numericXField} offset={-10} position="insideBottom" />
        </XAxis>
        <YAxis dataKey="y" type="number" name={yField} tickFormatter={fmtNum}>
          <Label value={yField} angle={-90} position="insideLeft" offset={10} />
        </YAxis>
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          formatter={(v: unknown) => [fmtNum(v)]}
        />
        <Scatter
          data={scatterData}
          fill={colors[0]}
          fillOpacity={0.65}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export const ScatterChartModel: ChartModel = {
  type: "scatter",
  label: "Dispersão",
  description: "Correlação entre variáveis numéricas",
  icon: "📍",
  minColumns: 2,
  cardinality: { min: 10 },
  render,
};
