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
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xField} />
        <YAxis />
        <Tooltip />
        <Legend />
        {valueCols.map((col, i) => (
          <Bar key={col} dataKey={col} fill={colors[i % colors.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export const ColumnChartModel: ChartModel = {
  type: "column",
  label: "Gráfico de Colunas",
  description: "Comparação vertical entre categorias",
  icon: "📋",
  minColumns: 2,
  render,
};
