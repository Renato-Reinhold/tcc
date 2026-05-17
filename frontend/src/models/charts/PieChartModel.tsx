import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartModel, ChartRenderProps } from "@/types/chart";
import { strVal, fmtNum } from "@/types/chart";

function render({ data, xField, yField, colors, onDataPointClick }: ChartRenderProps) {
  const pieData = data.map((d) => ({
    name: strVal(d[xField]),
    value: Number(d[yField]) || 0,
  }));
  // Use donut style when there are many slices — inner hole keeps labels readable
  const innerRadius = pieData.length > 5 ? 55 : 0;

  return (
    <ResponsiveContainer width="100%" height={400}>
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={130}
          dataKey="value"
          labelLine={pieData.length <= 7}
          label={({ name, percent }) => {
            // Hide labels for very small slices to prevent overlap
            if (percent < 0.03) return '';
            const n = String(name).length > 14 ? `${String(name).slice(0, 14)}…` : String(name);
            return `${n} ${(percent * 100).toFixed(0)}%`;
          }}
          cursor={onDataPointClick ? 'pointer' : undefined}
          onClick={(entry: { name?: string }) =>
            onDataPointClick?.(entry.name ?? '')
          }
        >
          {pieData.map((entry) => (
            <Cell key={entry.name} fill={colors[pieData.indexOf(entry) % colors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: unknown) => [fmtNum(v)]} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export const PieChartModel: ChartModel = {
  type: "pie",
  label: "Gráfico de Pizza",
  description: "Proporções e participações percentuais",
  icon: "🥧",
  minColumns: 2,
  cardinality: { min: 2, max: 7 },
  render,
};
