import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Label,
} from "recharts";
import type { ChartModel, ChartRenderProps } from "@/types/chart";

function render({ data, xField, yField, colors }: ChartRenderProps) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xField} type="number" name={xField}>
          <Label value={xField} offset={-5} position="insideBottom" />
        </XAxis>
        <YAxis dataKey={yField} type="number" name={yField}>
          <Label value={yField} angle={-90} position="insideLeft" />
        </YAxis>
        <Tooltip cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={data} fill={colors[0]} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export const ScatterChartModel: ChartModel = {
  type: "scatter",
  label: "Dispersão",
  description: "Correlação entre variáveis numéricas",
  icon: "📍",
  minColumns: 2,
  render,
};
