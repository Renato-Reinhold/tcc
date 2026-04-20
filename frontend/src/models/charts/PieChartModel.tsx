import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartModel, ChartRenderProps } from "@/types/chart";
import { strVal } from "@/types/chart";

function render({ data, xField, yField, colors }: ChartRenderProps) {
  const pieData = data.map((d) => ({
    name: strVal(d[xField]),
    value: Number(d[yField]) || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          outerRadius={140}
          dataKey="value"
          labelLine={false}
          label={({ name, percent }) =>
            `${name} ${(percent * 100).toFixed(0)}%`
          }
        >
          {pieData.map((entry) => (
            <Cell key={entry.name} fill={colors[pieData.indexOf(entry) % colors.length]} />
          ))}
        </Pie>
        <Tooltip />
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
  render,
};
