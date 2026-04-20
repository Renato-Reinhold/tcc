import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartModel, ChartRenderProps } from "@/types/chart";

function render({ data, xField, columns, colors }: ChartRenderProps) {
  const valueCols = columns.filter((c) => c !== xField);
  return (
    <ResponsiveContainer width="100%" height={400}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey={xField} />
        <PolarRadiusAxis />
        <Tooltip />
        <Legend />
        {valueCols.map((col, i) => (
          <Radar
            key={col}
            name={col}
            dataKey={col}
            stroke={colors[i % colors.length]}
            fill={colors[i % colors.length]}
            fillOpacity={0.25}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  );
}

export const RadarChartModel: ChartModel = {
  type: "radar",
  label: "Gráfico Radar",
  description: "Comparação multivariada em formato aranha",
  icon: "🕸️",
  minColumns: 2,
  render,
};
