import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartModel, ChartRenderProps } from "@/types/chart";

function render({ data, xField, yField, colors }: ChartRenderProps) {
  // Ordena decrescente por valor
  const sorted = [...data].sort(
    (a, b) => (Number(b[yField]) || 0) - (Number(a[yField]) || 0)
  );

  const total = sorted.reduce((s, d) => s + (Number(d[yField]) || 0), 0);
  let cumsum = 0;
  const paretoData = sorted.map((d) => {
    cumsum += Number(d[yField]) || 0;
    return {
      ...d,
      _cumPct: total > 0 ? Number.parseFloat(((cumsum / total) * 100).toFixed(1)) : 0,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={paretoData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xField} angle={-30} textAnchor="end" height={60} />
        <YAxis yAxisId="bar" />
        <YAxis
          yAxisId="line"
          orientation="right"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(value, name) =>
            name === "_cumPct" ? [`${value}%`, "Acumulado"] : [value, name]
          }
        />
        <Legend
          formatter={(value) =>
            value === "_cumPct" ? "% Acumulado" : value
          }
        />
        <Bar yAxisId="bar" dataKey={yField} fill={colors[0]} barSize={40} />
        <Line
          yAxisId="line"
          type="monotone"
          dataKey="_cumPct"
          stroke={colors[1] ?? "#ef4444"}
          strokeWidth={2}
          dot
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export const ParetoChartModel: ChartModel = {
  type: "pareto",
  label: "Gráfico de Pareto",
  description: "Análise 80/20 — causa e frequência acumulada",
  icon: "📏",
  minColumns: 2,
  render,
};
