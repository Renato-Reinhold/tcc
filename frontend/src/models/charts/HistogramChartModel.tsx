import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import type { ChartModel, ChartRenderProps } from "@/types/chart";

/** Cria bins para histograma a partir de uma coluna numérica */
function buildBins(values: number[], bins = 10) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = (max - min) / bins;
  const buckets = Array.from({ length: bins }, (_, i) => ({
    label: `${(min + i * step).toFixed(1)}–${(min + (i + 1) * step).toFixed(1)}`,
    count: 0,
  }));
  values.forEach((v) => {
    const idx = Math.min(Math.floor((v - min) / step), bins - 1);
    buckets[idx].count++;
  });
  return buckets;
}

function render({ data, yField, colors }: ChartRenderProps) {
  const values = data.map((d) => Number(d[yField])).filter((v) => !Number.isNaN(v));
  const bins = buildBins(values);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={bins} barCategoryGap="2%">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" angle={-30} textAnchor="end" height={60} />
        <YAxis label={{ value: "Frequência", angle: -90, position: "insideLeft" }} />
        <Tooltip />
        <Bar dataKey="count" name="Frequência">
          {bins.map((b) => (
            <Cell key={b.label} fill={colors[0]} fillOpacity={0.6 + 0.4 * (bins.indexOf(b) / bins.length)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const HistogramChartModel: ChartModel = {
  type: "histogram",
  label: "Histograma",
  description: "Distribuição de frequência de valores numéricos",
  icon: "📐",
  minColumns: 1,
  render,
};
