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
  // Rotate X labels when many categories to prevent overlap
  const rotateLabels = data.length > 7;
  // Skip some labels when extremely crowded
  const tickInterval = data.length > 30 ? Math.floor(data.length / 25) : 0;

  return (
    <ResponsiveContainer width="100%" height={420}>
      <BarChart
        data={data}
        margin={{ bottom: rotateLabels ? 40 : 10, top: 20, left: 8 }}
      >
        {/* Only horizontal grid lines for column charts */}
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey={xField}
          angle={rotateLabels ? -35 : 0}
          textAnchor={rotateLabels ? 'end' : 'middle'}
          height={rotateLabels ? 70 : 40}
          tick={{ fontSize: 12 }}
          interval={tickInterval}
        />
        {/* Always start from 0 so column heights are proportional to absolute values */}
        <YAxis tickFormatter={fmtNum} domain={[0, 'auto']} />
        <Tooltip formatter={(v: unknown) => [fmtNum(v)]} />
        <Legend />
        {valueCols.map((col, i) => (
          <Bar
            key={col}
            dataKey={col}
            fill={colors[i % colors.length]}
            radius={[4, 4, 0, 0]}
            cursor={onDataPointClick ? 'pointer' : undefined}
            onClick={(entry: Record<string, unknown>) =>
              onDataPointClick?.(String(entry[xField] ?? ''))
            }
          >
            {/* Show actual values for small datasets */}
            {data.length <= 15 && (
              <LabelList
                dataKey={col}
                position="top"
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

export const ColumnChartModel: ChartModel = {
  type: "column",
  label: "Gráfico de Colunas",
  description: "Comparação vertical entre categorias",
  icon: "📋",
  minColumns: 2,
  cardinality: { min: 2, max: 20 },
  render,
};
