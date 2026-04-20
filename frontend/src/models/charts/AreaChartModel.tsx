import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
      <AreaChart data={data}>
        <defs>
          {valueCols.map((col, i) => (
            <linearGradient key={col} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors[i % colors.length]} stopOpacity={0.8} />
              <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0.1} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xField} />
        <YAxis />
        <Tooltip />
        <Legend />
        {valueCols.map((col, i) => (
          <Area
            key={col}
            type="monotone"
            dataKey={col}
            stroke={colors[i % colors.length]}
            fill={`url(#grad-${i})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export const AreaChartModel: ChartModel = {
  type: "area",
  label: "Gráfico de Área",
  description: "Volume acumulado ao longo do tempo",
  icon: "📉",
  minColumns: 2,
  render,
};
