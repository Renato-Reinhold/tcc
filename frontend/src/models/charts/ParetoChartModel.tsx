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
import { fmtNum } from "@/types/chart";

function render({ data, xField, yField, colors }: ChartRenderProps) {
  // Sort descending by value (Pareto principle)
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

  const rotateLabels = paretoData.length > 7;

  return (
    <ResponsiveContainer width="100%" height={420}>
      <ComposedChart
        data={paretoData}
        margin={{ bottom: rotateLabels ? 40 : 10, right: 16 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey={xField}
          angle={rotateLabels ? -35 : 0}
          textAnchor={rotateLabels ? 'end' : 'middle'}
          height={rotateLabels ? 70 : 40}
          tick={{ fontSize: 12 }}
        />
        <YAxis yAxisId="bar" tickFormatter={fmtNum} domain={[0, 'auto']} />
        <YAxis
          yAxisId="line"
          orientation="right"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(value: unknown, name: string) =>
            name === "_cumPct" ? [`${value}%`, "Acumulado"] : [fmtNum(value), name]
          }
        />
        <Legend
          formatter={(value) =>
            value === "_cumPct" ? "% Acumulado" : value
          }
        />
        <Bar yAxisId="bar" dataKey={yField} fill={colors[0]} radius={[4, 4, 0, 0]} />
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
  cardinality: { min: 3, max: 25 },
  render,
};
