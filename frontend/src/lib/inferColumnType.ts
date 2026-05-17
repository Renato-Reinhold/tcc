// ─── Column type inference for file imports (CSV / XLSX / JSON) ─────────────
// Only used on the frontend; never called for database-sourced data.

export type FileColType = 'text' | 'number' | 'date' | 'boolean' | 'geo';

// Named-place geographic columns — a single column is enough for a map chart
const GEO_PLACE_KEYWORDS = [
  'cidade', 'city', 'estado', 'state', 'province', 'provincia',
  'pais', 'country', 'nation', 'nacao',
  'region', 'regiao', 'municipio', 'bairro',
  'district', 'distrito', 'uf', 'localidade', 'locality',
  'county', 'canton', 'departamento', 'zona',
  'neighborhood', 'suburb', 'cep', 'zipcode', 'postalcode', 'postal',
];

// Coordinate columns — lat AND lng must both be selected together
const GEO_LAT_KEYWORDS  = ['latitude', 'lat'];
const GEO_LNG_KEYWORDS  = ['longitude', 'lng', 'lon', 'long'];

// Combined set used by inferColumnType to tag a column as 'geo'
const GEO_KEYWORDS = [...GEO_PLACE_KEYWORDS, ...GEO_LAT_KEYWORDS, ...GEO_LNG_KEYWORDS,
  'coord', 'location', 'localizacao', 'geolocation', 'geolocalizacao'];

/** Returns true when the column name corresponds to a named-place geo column. */
export function isGeoPlaceCol(name: string): boolean {
  const n = name.toLowerCase().replace(/[\s_-]/g, '');
  return GEO_PLACE_KEYWORDS.some(kw => n.includes(kw.replace(/[\s_-]/g, '')));
}

/** Returns true when the column name corresponds to a latitude coordinate. */
export function isLatCol(name: string): boolean {
  const n = name.toLowerCase().replace(/[\s_-]/g, '');
  return GEO_LAT_KEYWORDS.some(kw => n === kw || n.startsWith(kw));
}

/** Returns true when the column name corresponds to a longitude coordinate. */
export function isLngCol(name: string): boolean {
  const n = name.toLowerCase().replace(/[\s_-]/g, '');
  return GEO_LNG_KEYWORDS.some(kw => n === kw || n.startsWith(kw));
}

// Known boolean value pairs (lowercase)
const BOOLEAN_PAIRS: ReadonlyArray<ReadonlySet<string>> = [
  new Set(['0', '1']),
  new Set(['s', 'n']),
  new Set(['sim', 'nao']),
  new Set(['sim', 'não']),
  new Set(['yes', 'no']),
  new Set(['true', 'false']),
  new Set(['verdadeiro', 'falso']),
  new Set(['t', 'f']),
  new Set(['ativo', 'inativo']),
  new Set(['active', 'inactive']),
  new Set(['ligado', 'desligado']),
  new Set(['on', 'off']),
  new Set(['habilitado', 'desabilitado']),
  new Set(['enabled', 'disabled']),
];

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}/,       // ISO: 2024-01-31
  /^\d{2}\/\d{2}\/\d{4}/,     // BR:  31/01/2024
  /^\d{2}-\d{2}-\d{4}/,       // 31-01-2024
  /^\d{4}\/\d{2}\/\d{2}/,     // 2024/01/31
  /^\d{4}-\d{2}-\d{2}T\d{2}/, // ISO datetime
];

/** How many rows to sample when inferring types (keeps it fast on large files). */
const SAMPLE_SIZE = 500;

/**
 * Infer the column type from its name and a sample of its values.
 *
 * Priority order:
 *  1. Geo   — column name matches a geographic keyword
 *  2. Number — every non-null value is parseable as a number
 *  3. Date   — every non-null value matches a date pattern
 *  4. Boolean — at most 2 distinct lowercase values matching a known boolean pair
 *  5. Text   — fallback
 */
export function inferColumnType(
  colName: string,
  allValues: unknown[],
): FileColType {
  // 1. Geo by name
  const normalized = colName.toLowerCase().replace(/[\s_-]/g, '');
  if (GEO_KEYWORDS.some(kw => normalized.includes(kw.replace(/[\s_-]/g, '')))) {
    return 'geo';
  }

  const sample = allValues.slice(0, SAMPLE_SIZE);
  const nonNull = sample
    .map(v => {
      if (v == null) return null;
      let s: string | null = null;
      if (typeof v === 'string') s = v;
      else if (typeof v === 'number' || typeof v === 'boolean') s = String(v);
      return s !== null && s.trim() !== '' ? s.trim() : null;
    })
    .filter((v): v is string => v !== null);

  if (nonNull.length === 0) return 'text';

  // 2. Number (accept comma as decimal separator)
  if (nonNull.every(v => !Number.isNaN(Number(v.replace(',', '.'))))) {
    return 'number';
  }

  // 3. Date
  if (nonNull.every(v => DATE_PATTERNS.some(p => p.test(v)))) {
    return 'date';
  }

  // 4. Boolean
  const distinct = new Set(nonNull.map(v => v.toLowerCase()));
  if (distinct.size <= 2) {
    const arr = [...distinct];
    const isBoolean = BOOLEAN_PAIRS.some(pair => arr.every(v => pair.has(v)));
    if (isBoolean) return 'boolean';
  }

  return 'text';
}

/**
 * Infer types for all columns from array-based rows (CSV / XLSX).
 * Returns a new array with the same columns but with inferred types.
 */
export function inferTypesFromArrayRows<T extends { name: string }>(
  columns: T[],
  rows: unknown[][],
): (T & { type: FileColType })[] {
  return columns.map((col, colIdx) => ({
    ...col,
    type: inferColumnType(col.name, rows.map(row => row[colIdx])),
  }));
}

/**
 * Infer types for all columns from object-based rows (JSON).
 */
export function inferTypesFromObjectRows<T extends { name: string }>(
  columns: T[],
  rows: Record<string, unknown>[],
): (T & { type: FileColType })[] {
  return columns.map(col => ({
    ...col,
    type: inferColumnType(col.name, rows.map(row => row[col.name])),
  }));
}

// ─── Display helpers (shared across Diagram, DataTable, TableDetail) ─────────

export function colTypeLabel(type: string): string {
  switch (type) {
    case 'number':  return '123';
    case 'date':    return 'data';
    case 'boolean': return 'T/F';
    case 'geo':     return 'geo';
    default:        return 'Aa';
  }
}

export function colTypeClass(type: string): string {
  switch (type) {
    case 'number':  return 'bg-chart-2/10 text-chart-2 border-chart-2/30';
    case 'date':    return 'bg-chart-3/10 text-chart-3 border-chart-3/30';
    case 'boolean': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    case 'geo':     return 'bg-purple-500/10 text-purple-600 border-purple-500/30';
    default:        return 'bg-chart-1/10 text-chart-1 border-chart-1/30';
  }
}

export function colTypeDescription(type: string): string {
  switch (type) {
    case 'number':  return 'Número';
    case 'date':    return 'Data';
    case 'boolean': return 'Booleano';
    case 'geo':     return 'Geolocalização';
    default:        return 'Texto';
  }
}
