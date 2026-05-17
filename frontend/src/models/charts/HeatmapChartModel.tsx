import type { ChartModel, ChartRenderProps } from "@/types/chart";
import { strVal } from "@/types/chart";

/** Interpola cor entre azul claro (#dbeafe) e azul escuro (#1e40af) */
function heatColor(ratio: number) {
  const r = Math.round(219 - ratio * (219 - 30));
  const g = Math.round(234 - ratio * (234 - 64));
  const b = Math.round(254 - ratio * (254 - 175));
  return `rgb(${r},${g},${b})`;
}

function render({ data, xField, yField, columns }: ChartRenderProps) {
  const valueField = columns.find((c) => c !== xField && c !== yField) ?? yField;

const xValues = [...new Set(data.map((d) => strVal(d[xField])))];  
  const yValues = [...new Set(data.map((d) => strVal(d[yField])))];

  const values = data.map((d) => Number(d[valueField]) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const cellMap: Record<string, number> = {};
  data.forEach((d) => {
    cellMap[`${strVal(d[xField])}__${strVal(d[yField])}`] = Number(d[valueField]) || 0;
  });

  return (
    <div className="overflow-auto p-2">
      <div className="text-xs text-muted-foreground mb-2">
        Valor: <span className="font-medium">{valueField}</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `80px repeat(${xValues.length}, minmax(40px, 1fr))`,
          gap: 2,
        }}
      >
        {/* Header row */}
        <div />
        {xValues.map((x) => (
          <div
            key={x}
            className="text-xs font-medium text-center truncate"
            style={{ minWidth: 40 }}
          >
            {x}
          </div>
        ))}

        {/* Data rows */}
        {yValues.map((y) => (
          <>
            <div key={`label-${y}`} className="text-xs font-medium flex items-center pr-2 truncate">
              {y}
            </div>
            {xValues.map((x) => {
              const val = cellMap[`${x}__${y}`] ?? 0;
              const ratio = max === min ? 0 : (val - min) / (max - min);
              return (
                <div
                  key={`${x}-${y}`}
                  title={`${x} / ${y}: ${val}`}
                  className="rounded text-xs flex items-center justify-center"
                  style={{
                    backgroundColor: heatColor(ratio),
                    height: 36,
                    color: ratio > 0.6 ? "#fff" : "#1e293b",
                    fontSize: 10,
                  }}
                >
                  {val === 0 ? "" : val}
                </div>
              );
            })}
          </>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-muted-foreground">Min</span>
        <div
          style={{
            background: `linear-gradient(to right, ${heatColor(0)}, ${heatColor(1)})`,
            height: 12,
            width: 120,
            borderRadius: 4,
          }}
        />
        <span className="text-xs text-muted-foreground">Max</span>
        <span className="text-xs ml-2 text-muted-foreground">
          ({min} – {max})
        </span>
      </div>
    </div>
  );
}

export const HeatmapChartModel: ChartModel = {
  type: "heatmap",
  label: "Mapa de Calor",
  description: "Distribuição de intensidade em grade bidimensional",
  icon: "🌡️",
  minColumns: 3,
  cardinality: { min: 4, max: 200 },
  render,
};
