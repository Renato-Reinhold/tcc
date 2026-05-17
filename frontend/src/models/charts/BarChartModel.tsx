import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";
import type { ChartModel, ChartRenderProps } from "@/types/chart";
import { fmtNum } from "@/types/chart";

function render({ data, xField, columns, colors, onDataPointClick }: ChartRenderProps) {
  const valueCols = columns.filter((c) => c !== xField);
  // Dynamic Y-axis width so long category labels are never truncated
  const maxLabelLen = data.reduce((m, d) => Math.max(m, String(d[xField] ?? '').length), 0);
  const yAxisWidth = Math.max(80, Math.min(200, maxLabelLen * 7));
  // Scale chart height with data length so bars don’t become paper-thin
  const chartHeight = Math.max(300, data.length * 30 + 60);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ right: 60, left: 4 }}>
        {/* Only vertical grid lines — horizontal ones are redundant for horizontal bars */}
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        {/* Always start from 0 so bar lengths are proportional to absolute values */}
        <XAxis type="number" tickFormatter={fmtNum} domain={[0, 'auto']} />
        <YAxis type="category" dataKey={xField} width={yAxisWidth} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v: unknown) => [fmtNum(v)]} />
        <Legend />
        {valueCols.map((col, i) => (
          <Bar
            key={col}
            dataKey={col}
            fill={colors[i % colors.length]}
            radius={[0, 4, 4, 0]}
            cursor={onDataPointClick ? 'pointer' : undefined}
            onClick={(entry: Record<string, unknown>) =>
              onDataPointClick?.(String(entry[xField] ?? ''))
            }
          >
            {/* Show actual values for small datasets */}
            {data.length <= 20 && (
              <LabelList
                dataKey={col}
                position="right"
                formatter={fmtNum}
                style={{ fontSize: 11, fill: '#6b7280' }}
              />
            )}
          </Bar>
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
  cardinality: { min: 2, max: 50 },
  render,
};
