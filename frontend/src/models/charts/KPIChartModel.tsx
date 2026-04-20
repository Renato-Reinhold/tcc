import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
} from "recharts";
import type { ChartModel, ChartRenderProps } from "@/types/chart";

function render({ data, yField, xField, title, colors }: ChartRenderProps) {
  const values = data.map((d) => Number(d[yField]) || 0);
  const current = values[values.length - 1] ?? 0;
  const previous = values[values.length - 2] ?? current;
  const delta = previous === 0 ? 0 : ((current - previous) / Math.abs(previous)) * 100;
  const label = title ?? yField;
  const isPositive = delta >= 0;

  const sparkData = data.map((d) => ({ v: Number(d[yField]) || 0 }));

  return (
    <div className="flex flex-col items-center justify-center h-[300px] gap-2 select-none">
      <p className="text-sm text-muted-foreground uppercase tracking-widest font-medium">
        {label}
      </p>
      <p
        className="font-extrabold leading-none"
        style={{ fontSize: "clamp(2.5rem, 8vw, 5rem)" }}
      >
        {current.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
      </p>
      <span
        className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
          isPositive
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-700"
        }`}
      >
        {isPositive ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
      </span>

      {/* Sparkline */}
      <div className="w-full max-w-xs h-16 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparkData}>
            <Line
              type="monotone"
              dataKey="v"
              stroke={colors[0]}
              strokeWidth={2}
              dot={false}
            />
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <span className="text-xs bg-white shadow px-2 py-1 rounded border">
                    {Number(payload[0].value).toLocaleString("pt-BR")}
                  </span>
                ) : null
              }
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        vs período anterior ({xField})
      </p>
    </div>
  );
}

export const KPIChartModel: ChartModel = {
  type: "kpi",
  label: "KPI",
  description: "Indicador chave com variação e sparkline",
  icon: "📌",
  minColumns: 1,
  render,
};
