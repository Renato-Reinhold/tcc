import type { ChartModel, ChartRenderProps } from "@/types/chart";

/** Placeholder para mapa geográfico — requer biblioteca adicional (leaflet/mapbox) */
function render({ data, xField, yField }: ChartRenderProps) {
  return (
    <div className="flex flex-col items-center justify-center h-[300px] gap-3 text-center bg-muted/20 rounded-lg border-2 border-dashed">
      <span className="text-5xl">🗺️</span>
      <p className="font-semibold">Mapa Geográfico</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        Visualização de mapa requer campos de latitude/longitude.
        <br />
        Usando <strong>{xField}</strong> e <strong>{yField}</strong> como
        coordenadas.
      </p>
      <div className="text-xs text-muted-foreground bg-muted rounded px-3 py-1">
        {data.length} pontos encontrados
      </div>
    </div>
  );
}

export const MapChartModel: ChartModel = {
  type: "map",
  label: "Mapa",
  description: "Visualização geoespacial de dados",
  icon: "🗺️",
  minColumns: 2,
  render,
};
