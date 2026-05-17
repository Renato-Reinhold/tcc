/* eslint-disable react-refresh/only-export-components */
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import type { ChartModel, ChartRenderProps } from "@/types/chart";
import { strVal } from "@/types/chart";

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
];

interface TreeNode {
  name: string;
  size: number;
  fill: string;
}

interface TreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  fill?: string;
}

function TreemapCell({ x = 0, y = 0, width = 0, height = 0, name = "", fill = "#3b82f6" }: Readonly<TreemapContentProps>) {
  if (width < 30 || height < 20) return null;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="#fff"
        strokeWidth={2}
        fillOpacity={0.85}
      />
      {width > 50 && height > 30 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff"
          fontSize={Math.min(14, width / 6)}
          fontWeight="bold"
        >
          {String(name).length > 12 ? `${String(name).slice(0, 12)}…` : name}
        </text>
      )}
    </g>
  );
}

function render({ data, xField, yField }: ChartRenderProps) {
  const treeData: TreeNode[] = data.map((d, i) => ({
    name: strVal(d[xField]),
    size: Math.max(Number(d[yField]) || 0, 0),
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <Treemap
        data={treeData}
        dataKey="size"
        nameKey="name"
        aspectRatio={4 / 3}
        content={<TreemapCell />}
      >
        <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR")} />
      </Treemap>
    </ResponsiveContainer>
  );
}

export const TreeMapChartModel: ChartModel = {
  type: "treemap",
  label: "TreeMap",
  description: "Hierarquia proporcional ao valor",
  icon: "🗺️",
  minColumns: 2,
  cardinality: { min: 3, max: 100 },
  render,
};
