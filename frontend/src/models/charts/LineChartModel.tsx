import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartModel, ChartRenderProps } from "@/types/chart";

function render({ data, xField, columns, colors }: ChartRenderProps) {
  const valueCols = columns.filter((c) => c !== xField);
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xField} />
        <YAxis />
        <Tooltip />
        <Legend />
        {valueCols.map((col, i) => (
          <Line
            key={col}
            type="monotone"
            dataKey={col}
            stroke={colors[i % colors.length]}
            strokeWidth={2}
            dot={data.length < 50}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export const LineChartModel: ChartModel = {
  type: "line",
  label: "Gráfico de Linhas",
  description: "Tendências e séries temporais",
  icon: "📈",
  minColumns: 2,
  render,
};
