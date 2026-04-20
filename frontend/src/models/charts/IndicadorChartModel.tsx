import type { ChartModel, ChartRenderProps } from "@/types/chart";

function render({ data, yField, xField, title }: ChartRenderProps) {
  const value = Number(data[0]?.[yField] ?? data[0]?.[xField] ?? 0);
  const label = title ?? yField;

  const formatted = value.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  });

  return (
    <div className="flex flex-col items-center justify-center h-[300px] gap-4 select-none">
      <p className="text-sm text-muted-foreground uppercase tracking-widest font-medium">
        {label}
      </p>
      <p
        className="font-extrabold leading-none"
        style={{ fontSize: "clamp(3rem, 10vw, 6rem)" }}
      >
        {formatted}
      </p>
      {data.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Baseado em {data.length} registros
        </p>
      )}
    </div>
  );
}

export const IndicadorChartModel: ChartModel = {
  type: "indicador",
  label: "Indicador",
  description: "Exibe um único valor de destaque",
  icon: "🔢",
  minColumns: 1,
  render,
};
