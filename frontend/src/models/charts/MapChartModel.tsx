import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ChartModel, ChartRenderProps, DataValue } from "@/types/chart";
import { isLatCol, isLngCol, isGeoPlaceCol } from "@/lib/inferColumnType";

const COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))",
];

/** Auto-adjusts the map viewport to show all data points. */
function AutoBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    try {
      map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 12 });
    } catch { /* empty */ }
  }, [map, points]);
  return null;
}

// Nominatim geocoding
interface GeoPoint { place: string; lat: number; lng: number; count: number }
type Coords = { lat: number; lng: number };

// localStorage cache so each city is only looked up once, ever
const GEO_CACHE_KEY = 'tcc_geo_cache_v1';

function readGeoCache(): Map<string, Coords> {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (raw) return new Map(Object.entries(JSON.parse(raw) as Record<string, Coords>));
  } catch { /* ignore */ }
  return new Map();
}

function writeGeoCache(cache: Map<string, Coords>) {
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(Object.fromEntries(cache)));
  } catch { /* localStorage full — skip */ }
}

async function geocodePlace(name: string): Promise<Coords | null> {
  const cache = readGeoCache();
  const cached = cache.get(name);
  if (cached) return cached;
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "User-Agent": "TCC-DataViz/1.0 (academic-project)",
      },
    });
    const json = await res.json() as Array<{ lat: string; lon: string }>;
    if (json.length > 0) {
      const coords: Coords = { lat: Number(json[0].lat), lng: Number(json[0].lon) };
      cache.set(name, coords);
      writeGeoCache(cache);
      return coords;
    }
  } catch { /* network error */ }
  return null;
}

const NOMINATIM_DELAY_MS = 1100;

function GeocodedMap({
  data, placeKey, activeColor,
}: Readonly<{
  data: Array<Record<string, DataValue>>;
  placeKey: string;
  activeColor: string;
}>) {
  const topPlaces = useMemo(() => {
    const freq = new Map<string, number>();
    for (const row of data) {
      const place = String(row[placeKey] ?? "").trim();
      if (place) freq.set(place, (freq.get(place) ?? 0) + 1);
    }
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50);
  }, [data, placeKey]);

  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setProgress(0);
    setPoints([]);

    const run = async () => {
      const cache = readGeoCache();
      const results: GeoPoint[] = [];

      // Separate cached (instant) vs uncached (need Nominatim API + rate limit)
      const fromCache: typeof topPlaces = [];
      const needsApi: typeof topPlaces = [];
      for (const entry of topPlaces) {
        (cache.has(entry[0]) ? fromCache : needsApi).push(entry);
      }

      // Process cached places immediately — no network, no delay
      for (const [place, count] of fromCache) {
        if (cancelled) return;
        const coords = cache.get(place);
        if (coords) results.push({ place, ...coords, count });
      }
      setProgress(fromCache.length);

      // Process uncached places with 1.1 s rate limit (Nominatim policy)
      for (let i = 0; i < needsApi.length; i++) {
        if (cancelled) return;
        if (i > 0) await new Promise<void>(r => setTimeout(r, NOMINATIM_DELAY_MS));
        const [place, count] = needsApi[i];
        const coords = await geocodePlace(place);
        if (coords) results.push({ place, ...coords, count });
        setProgress(fromCache.length + i + 1);
      }

      if (!cancelled) {
        setPoints(results);
        setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [topPlaces]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[320px] gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium">
          Geocodificando localidades\u2026 {progress}/{topPlaces.length}
        </p>
        <p className="text-xs text-muted-foreground">
          Aguarde \u2014 m\u00e1x. 1 consulta/s (pol\u00edtica OpenStreetMap)
        </p>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[280px] gap-2 text-center">
        <span className="text-4xl">\U0001f6a7</span>
        <p className="text-sm font-medium">Nenhuma localidade p\u00f4de ser geocodificada</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Verifique se os nomes est\u00e3o corretos ou selecione colunas de latitude e longitude.
        </p>
      </div>
    );
  }

  const latLngs: [number, number][] = points.map(p => [p.lat, p.lng]);
  const center: [number, number] = [
    points.reduce((s, p) => s + p.lat, 0) / points.length,
    points.reduce((s, p) => s + p.lng, 0) / points.length,
  ];
  const maxCount = Math.max(...points.map(p => p.count));

  return (
    <div className="h-[400px] w-full rounded-lg overflow-hidden border border-border">
      <MapContainer center={center} zoom={4} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AutoBounds points={latLngs} />
        {points.map((p) => (
          <CircleMarker
            key={`${p.lat.toFixed(5)},${p.lng.toFixed(5)}`}
            center={[p.lat, p.lng]}
            radius={5 + Math.round((p.count / maxCount) * 12)}
            pathOptions={{ color: activeColor, fillColor: activeColor, fillOpacity: 0.7, weight: 1.5 }}
          >
            <Popup>
              <span className="text-xs font-semibold">{p.place}</span>
              <br />
              <span className="text-xs text-gray-500">
                {p.count.toLocaleString("pt-BR")} registros
              </span>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

function render({ data, xField, colors }: ChartRenderProps) {
  const allKeys = data.length > 0 ? Object.keys(data[0]) : [];
  const activeColor = colors?.[0] ?? COLORS[0];

  // Lat / Lng: mapa interativo real
  const latKey = allKeys.find(k => isLatCol(k));
  const lngKey = allKeys.find(k => isLngCol(k));

  if (latKey && lngKey) {
    const points = data
      .map((row) => ({
        lat: Number(row[latKey]),
        lng: Number(row[lngKey]),
        label: String(row[xField] ?? ""),
      }))
      .filter(p => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));

    if (points.length === 0) {
      return (
        <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">
          Nenhuma coordenada v\u00e1lida encontrada nos dados.
        </div>
      );
    }

    const latLngs: [number, number][] = points.map(p => [p.lat, p.lng]);
    const center: [number, number] = [
      points.reduce((s, p) => s + p.lat, 0) / points.length,
      points.reduce((s, p) => s + p.lng, 0) / points.length,
    ];

    return (
      <div className="h-[400px] w-full rounded-lg overflow-hidden border border-border">
        <MapContainer
          center={center}
          zoom={4}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AutoBounds points={latLngs} />
          {points.map((p) => (
            <CircleMarker
              key={`${p.lat.toFixed(6)},${p.lng.toFixed(6)}`}
              center={[p.lat, p.lng]}
              radius={6}
              pathOptions={{ color: activeColor, fillColor: activeColor, fillOpacity: 0.75, weight: 1.5 }}
            >
              {p.label && (
                <Popup>
                  <span className="text-xs font-medium">{p.label}</span>
                  <br />
                  <span className="text-xs text-gray-500">
                    {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                  </span>
                </Popup>
              )}
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    );
  }

  // Coluna de localidade: geocodificar via Nominatim
  const placeKey = allKeys.find(k => isGeoPlaceCol(k)) ?? xField;
  if (placeKey) {
    return <GeocodedMap data={data} placeKey={placeKey} activeColor={activeColor} />;
  }

  // Fallback placeholder
  return (
    <div className="flex flex-col items-center justify-center h-[300px] gap-3 text-center bg-muted/20 rounded-lg border-2 border-dashed">
      <span className="text-5xl">\U0001f5fa\ufe0f</span>
      <p className="font-semibold">Mapa Geogr\u00e1fico</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        Selecione colunas de <strong>latitude</strong> e <strong>longitude</strong> para um mapa de
        pontos, ou uma coluna de localidade (cidade, estado, pa\u00eds\u2026) para geocodifica\u00e7\u00e3o autom\u00e1tica.
      </p>
    </div>
  );
}

export const MapChartModel: ChartModel = {
  type: "map",
  label: "Mapa",
  description: "Visualiza\u00e7\u00e3o geoespacial de dados",
  icon: "🗺️",
  minColumns: 1,
  cardinality: { min: 1 },
  render,
};
