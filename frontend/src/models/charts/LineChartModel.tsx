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
import { fmtNum } from "@/types/chart";

function render({ data, xField, columns, colors, onDataPointClick }: ChartRenderProps) {
  const valueCols = columns.filter((c) => c !== xField);
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xField} tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={fmtNum} />
        <Tooltip formatter={(v: unknown) => [fmtNum(v)]} />
        <Legend />
        {valueCols.map((col, i) => (
          <Line
            key={col}
            type="monotone"
            dataKey={col}
            stroke={colors[i % colors.length]}
            strokeWidth={2}
            dot={data.length < 50}
            activeDot={onDataPointClick ? {
              onClick: (_event: unknown, payload: Record<string, unknown>) =>
                onDataPointClick(String((payload.payload as Record<string, unknown>)?.[xField] ?? '')),
            } : undefined}
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
  cardinality: { min: 3 },
  render,
};
