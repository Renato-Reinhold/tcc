import {
  ResponsiveContainer,
  BarChart,
  Bar,
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
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />
        <YAxis type="category" dataKey={xField} width={120} />
        <Tooltip />
        <Legend />
        {valueCols.map((col, i) => (
          <Bar key={col} dataKey={col} fill={colors[i % colors.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export const BarChartModel: ChartModel = {
  type: "bar",
  label: "Gráfico de Barras",
  description: "Comparação horizontal de categorias",
  icon: "📊",
  minColumns: 2,
  render,
};
