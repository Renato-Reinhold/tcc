import { useState, useMemo, useEffect, useTransition, useRef, useCallback, Fragment } from "react";
import { ChevronLeft, ChevronRight, Download, Filter, Palette, Type, Settings, Zap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import type { ProcessedData } from "@/pages/Index";
import { toast } from "@/hooks/use-toast";
import { ChartRenderer } from "@/components/ChartRenderer";
import { ALL_CHART_MODELS } from "@/models/ChartRegistry";
import { normalizeChartType } from "@/types/chart";
import type { ChartType, DataValue } from "@/types/chart";
import { isGeoPlaceCol, isLatCol, isLngCol } from "@/lib/inferColumnType";

interface ChartGeneratorProps {
  data: ProcessedData;
  selectedColumns: string[];
  /** Tipo recomendado pelo backend (string livre) */
  recommendedType?: string;
  onBackToData: () => void;
  onBackToUpload: () => void;
}

const CHART_MAX_POINTS = 10000;

// Chart types that aggregate rows: group by xField and SUM yField across ALL data
const AGGREGATE_TYPES = new Set<ChartType>(['bar', 'line', 'area', 'pie', 'column', 'treemap', 'pareto', 'radar'] as ChartType[]);

// djb2-based hash — cheap cache key for chartData computation
function quickHash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ (str.codePointAt(i) ?? 0)) >>> 0;
  return h.toString(36);
}

/** Returns 'few' / 'many' / 'ok' based on how many distinct groups the data has vs the chart's cardinality range */
function getCardinalityStatus(
  model: { cardinality?: { min?: number; max?: number } },
  count: number,
): 'ok' | 'few' | 'many' {
  if (!model.cardinality || count === 0) return 'ok';
  const { min, max } = model.cardinality;
  if (min !== undefined && count < min) return 'few';
  if (max !== undefined && count > max) return 'many';
  return 'ok';
}

const colorSchemes = [
  { name: 'Padrão', colors: ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'] },
  { name: 'Azul',    colors: ['#3B82F6', '#1D4ED8', '#1E40AF', '#1E3A8A', '#312E81'] },
  { name: 'Verde',   colors: ['#10B981', '#059669', '#047857', '#065F46', '#064E3B'] },
  { name: 'Roxo',    colors: ['#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6', '#4C1D95'] },
  { name: 'Laranja', colors: ['#F59E0B', '#D97706', '#B45309', '#92400E', '#78350F'] },
];

export const ChartGenerator = ({
  data,
  selectedColumns,
  recommendedType,
  onBackToData,
  onBackToUpload,
}: ChartGeneratorProps) => {
  const [isGenerating, setIsGenerating] = useState(true);
  const [colorScheme, setColorScheme] = useState(0);
  const [chartTitle, setChartTitle] = useState('Gráfico dos Dados');
  const [xAxisTitle, setXAxisTitle] = useState('');
  const [yAxisTitle, setYAxisTitle] = useState('');

  // Tipo inicial vem do backend (recomendado) ou é inferido localmente
  const localRecommended = useMemo<ChartType>(() => {
    if (recommendedType) return normalizeChartType(recommendedType);
    const numCols = selectedColumns.filter((c) => {
      const col = data.columns.find((dc) => dc.name === c);
      return col?.type === 'number';
    });
    const dateCols = selectedColumns.filter((c) => {
      const col = data.columns.find((dc) => dc.name === c);
      return col?.type === 'date';
    });
    const geoCols = selectedColumns.filter((c) => {
      const col = data.columns.find((dc) => dc.name === c);
      return col?.type === 'geo';
    });
    if (geoCols.length > 0) {
      const hasPlace = geoCols.some(c => isGeoPlaceCol(c));
      const hasLat   = geoCols.some(c => isLatCol(c));
      const hasLng   = geoCols.some(c => isLngCol(c));
      if (hasPlace || (hasLat && hasLng)) return 'map';
    }
    if (dateCols.length > 0 && numCols.length > 0) return 'line';
    if (numCols.length >= 2) return 'scatter';
    return 'bar';
  }, [recommendedType, selectedColumns, data.columns]);

  const [chartType, setChartType] = useState<ChartType>(localRecommended);

  // Show a loading overlay while the new chart computation settles
  const [isPending, startTransition] = useTransition();
  const handleChartTypeChange = (type: ChartType) => startTransition(() => setChartType(type));

  // Drill-down path: each entry is a { field, value } filter applied before aggregation
  type DrillItem = { field: string; value: string };
  const [drillPath, setDrillPath] = useState<DrillItem[]>([]);

  // Aggregation mode (applies to AGGREGATE_TYPES)
  type AggMode = 'sum' | 'avg' | 'count' | 'max' | 'min';
  const [aggMode, setAggMode] = useState<AggMode>('sum');

  // Top-N filter: show only N highest-value groups after aggregation (0 = all)
  const [topN, setTopN] = useState<number>(0);

  // Date range pre-filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsGenerating(false);
      toast({
        title: "Gráfico gerado com sucesso!",
        description: "Seu gráfico foi criado e está pronto para personalização",
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // The aggregation column is always named 'valor' (or the last column as fallback)
  const valueCol = useMemo(() => {
    const exact = selectedColumns.find((c) => c === 'valor' || c.endsWith('.valor'));
    if (exact) return exact;
    // Detect by column type — last numeric column
    const numericCols = selectedColumns.filter((c) => {
      const col = data.columns.find((dc) => dc.name === c);
      return col?.type === 'number';
    });
    if (numericCols.length > 0) return numericCols[numericCols.length - 1];
    return selectedColumns[selectedColumns.length - 1] ?? '';
  }, [selectedColumns, data.columns]);

  const groupByCols = useMemo(
    () => selectedColumns.filter((c) => c !== valueCol),
    [selectedColumns, valueCol],
  );

  // Sample-based cardinality: fewest unique values = best group-by key for the X axis
  const colCardinality = useMemo(() => {
    const card: Record<string, number> = {};
    if (!data.rows.length) return card;
    const sampleEnd = Math.min(data.rows.length, 2000);
    const firstRow = data.rows[0];
    const isObj = firstRow != null && typeof firstRow === 'object' && !Array.isArray(firstRow);
    const indexMap = isObj ? null : new Map(data.columns.map((c, i) => [c.name, i]));
    for (const col of selectedColumns) {
      const seen = new Set<string>();
      for (let i = 0; i < sampleEnd; i++) {
        const row = data.rows[i];
        const v = isObj
          ? (row as unknown as Record<string, unknown>)[col]
          : (row as unknown[])[indexMap?.get(col) ?? -1];
        seen.add(v == null ? '' : typeof v === 'object' ? '[obj]' : String(v));
      }
      card[col] = seen.size;
    }
    return card;
  }, [data.rows, data.columns, selectedColumns]);

  // Re-order groupByCols so the column with fewest distinct values leads (→ becomes xField)
  const sortedGroupByCols = useMemo(
    () => [...groupByCols].sort((a, b) => (colCardinality[a] ?? 0) - (colCardinality[b] ?? 0)),
    [groupByCols, colCardinality],
  );

  // Hash-based cache: skip re-aggregating when only visual settings (color, title) change
  const chartDataCache = useRef(new Map<string, Array<Record<string, DataValue>>>());

  // Active group-by columns: skip levels already consumed by drillPath
  const activeGroupCols = useMemo(
    () => sortedGroupByCols.slice(drillPath.length),
    [sortedGroupByCols, drillPath],
  );

  // Reset drill path when available group-by columns change (column selection changed)
  useEffect(() => { setDrillPath([]); }, [sortedGroupByCols]);

  // Dados mapeados para array de objetos, com agregação automática para datasets grandes
  const chartData = useMemo((): Array<Record<string, DataValue>> => {
    if (!data.rows || data.rows.length === 0) return [];

    // Cache key: everything that affects the aggregated result (not visual settings)
    const cacheKey = quickHash([
      selectedColumns.join(','),
      activeGroupCols.join(','),
      JSON.stringify(drillPath),
      aggMode,
      dateFrom,
      dateTo,
      chartType,
      String(data.rows.length),
    ].join('|'));
    const cached = chartDataCache.current.get(cacheKey);
    if (cached) return cached;

    const firstRow = data.rows[0];
    const isObjectRow = firstRow !== null && typeof firstRow === 'object' && !Array.isArray(firstRow);
    const colIndexMap: Map<string, number> | null = isObjectRow
      ? null
      : new Map(data.columns.map((col, i) => [col.name, i]));

    const getVal = (row: unknown[] | Record<string, unknown>, colName: string): unknown => {
      if (isObjectRow) return (row as Record<string, unknown>)[colName];
      const idx = colIndexMap?.get(colName) ?? -1;
      return idx >= 0 ? (row as unknown[])[idx] : undefined;
    };

    const toDataVal = (raw: unknown): DataValue => {
      if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) return Number(raw);
      return raw as DataValue;
    };

    // Detect date column for range filter
    const _dateCol = (dateFrom || dateTo)
      ? selectedColumns.find(c => data.columns.find(dc => dc.name === c)?.type === 'date')
      : undefined;

    // Filter source rows by drill path + date range
    const filteredRows = data.rows.filter((row) => {
      for (const { field, value } of drillPath) {
        if (String(getVal(row, field) ?? '') !== value) return false;
      }
      if (_dateCol) {
        const raw = getVal(row, _dateCol);
        const d = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw ?? '').slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
      return true;
    });

    const mapRow = (row: unknown[] | Record<string, unknown>): Record<string, DataValue> => {
      const item: Record<string, DataValue> = {};
      for (const colName of selectedColumns) item[colName] = toDataVal(getVal(row, colName));
      if (activeGroupCols.length > 1) {
        item['_x_label_'] = activeGroupCols.map(c => String(item[c] ?? '')).join(' / ');
      }
      return item;
    };

    const xKey = activeGroupCols.length > 1 ? '_x_label_' : (activeGroupCols[0] ?? selectedColumns[0] ?? '');
    const yKey = valueCol;

    let result: Array<Record<string, DataValue>>;

    if (AGGREGATE_TYPES.has(chartType) && xKey && yKey) {
      type AggState = { sum: number; count: number; max: number; min: number };
      const grouped = new Map<string, AggState>();
      for (const row of filteredRows) {
        const item = mapRow(row);
        const key = String(item[xKey] ?? '(vazio)');
        const val = Number(item[yKey]) || 0;
        const prev = grouped.get(key);
        if (prev) {
          prev.sum += val; prev.count += 1;
          if (val > prev.max) prev.max = val;
          if (val < prev.min) prev.min = val;
        } else {
          grouped.set(key, { sum: val, count: 1, max: val, min: val });
        }
      }
      const aggFn = (s: AggState): number => {
        switch (aggMode) {
          case 'avg': return s.count > 0 ? s.sum / s.count : 0;
          case 'count': return s.count;
          case 'max': return s.max;
          case 'min': return s.min;
          default: return s.sum;
        }
      };
      result = Array.from(grouped.entries())
        .map(([key, state]) => ({ [xKey]: key, [yKey]: aggFn(state) }))
        .sort((a, b) => (Number(b[yKey]) || 0) - (Number(a[yKey]) || 0))
        .slice(0, CHART_MAX_POINTS);
    } else {
      const rows = filteredRows.length <= CHART_MAX_POINTS
        ? filteredRows
        : filteredRows.filter((_, i) => i % Math.ceil(filteredRows.length / CHART_MAX_POINTS) === 0);
      result = rows.map(mapRow);
    }

    chartDataCache.current.set(cacheKey, result);
    return result;
  }, [data, selectedColumns, activeGroupCols, valueCol, chartType, drillPath, aggMode, dateFrom, dateTo]);

  // xField: composite label when >1 active group-by col, else lowest-cardinality active col
  const xField = activeGroupCols.length > 1 ? '_x_label_' : (activeGroupCols[0] ?? selectedColumns[0] ?? '');
  // yField: always the aggregation/value column
  const yField = valueCol;

  // Post-aggregation Top-N slice
  const displayData = useMemo(
    () => (topN > 0 ? chartData.slice(0, topN) : chartData),
    [chartData, topN],
  );

  // Drill-down: clicking a bar/slice filters to that value and groups by the next column
  const handleDataPointClick = useCallback((value: string | number) => {
    const field = activeGroupCols[0];
    if (!field) return;
    if (drillPath.length >= sortedGroupByCols.length - 1) return;
    setDrillPath(prev => [...prev, { field, value: String(value) }]);
  }, [activeGroupCols, drillPath.length, sortedGroupByCols.length]);

  // Detect selected date column for conditional date-range filter UI
  const dateCol = useMemo(
    () => selectedColumns.find(c => data.columns.find(dc => dc.name === c)?.type === 'date'),
    [selectedColumns, data.columns],
  );

  // Distinct X-axis groups in the primary group-by column (used for cardinality warnings)
  const xCardinality = sortedGroupByCols.length > 0
    ? (colCardinality[sortedGroupByCols[0]] ?? 0)
    : (colCardinality[selectedColumns[0]] ?? 0);

  // ── Build pivot table matrix (mirrors PivotTableChartModel logic) ─────────
  const buildPivotMatrix = () => {
    const rowVals = [...new Set(chartData.map(d => String(d[xField] ?? '')))];
    const colVals = [...new Set(chartData.map(d => String(d[yField] ?? '')))];
    const valueField = selectedColumns.find(c => c !== xField && c !== yField);
    const lookup: Record<string, Record<string, unknown>> = {};
    for (const d of chartData) {
      const r = String(d[xField] ?? '');
      const c = String(d[yField] ?? '');
      if (!lookup[r]) lookup[r] = {};
      lookup[r][c] = valueField ? d[valueField] : 1;
    }
    const colTotals: Record<string, number> = {};
    for (const col of colVals) {
      colTotals[col] = rowVals.reduce((s, row) => s + (Number(lookup[row]?.[col]) || 0), 0);
    }
    const grandTotal = Object.values(colTotals).reduce((s, v) => s + v, 0);
    return { rowVals, colVals, lookup, colTotals, grandTotal };
  };

  const handleExportPivotCSV = () => {
    const { rowVals, colVals, lookup, colTotals, grandTotal } = buildPivotMatrix();
    const esc = (s: string) => (s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s);
    const header = [`${xField} / ${yField}`, ...colVals, 'Total'].map(esc).join(',');
    const dataRows = rowVals.map(row => {
      const rowTotal = colVals.reduce((s, col) => s + (Number(lookup[row]?.[col]) || 0), 0);
      return [row, ...colVals.map(col => {
        const cell = lookup[row]?.[col];
        if (cell == null) return '';
        if (typeof cell === 'object') return JSON.stringify(cell);
        if (typeof cell === 'string') return cell;
        if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell);
        return '';
      }), String(rowTotal)].map(esc).join(',');
    });
    const totalRow = ['Total', ...colVals.map(col => String(colTotals[col] ?? 0)), String(grandTotal)].map(esc).join(',');
    const csv = '\uFEFF' + [header, ...dataRows, totalRow].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tabela-dinamica-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast({ title: 'Sucesso!', description: 'Tabela exportada como CSV' });
  };

  const handleExportPivotXLSX = () => {
    const { rowVals, colVals, lookup, colTotals, grandTotal } = buildPivotMatrix();
    const sheetData: (string | number)[][] = [
      [`${xField} / ${yField}`, ...colVals, 'Total'],
      ...rowVals.map(row => {
        const rowTotal = colVals.reduce((s, col) => s + (Number(lookup[row]?.[col]) || 0), 0);
        return [row, ...colVals.map(col => {
          const v = lookup[row]?.[col];
          if (v === undefined || v === null) return '';
          if (typeof v === 'number') return v;
          if (typeof v === 'boolean') return v ? 1 : 0;
          if (typeof v === 'string') return Number.isNaN(Number(v)) ? v : Number(v);
          return JSON.stringify(v);
        }), rowTotal] as (string | number)[];
      }),
      ['Total', ...colVals.map(col => colTotals[col] ?? 0), grandTotal],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tabela Dinâmica');
    XLSX.writeFile(wb, `tabela-dinamica-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: 'Sucesso!', description: 'Tabela exportada como Excel' });
  };

  const handleExport = async (format: 'png' | 'svg' | 'pdf') => {
    try {
      const chartElement = document.getElementById('chart-container');
      if (!chartElement) {
        toast({ title: "Erro", description: "Gráfico não encontrado", variant: "destructive" });
        return;
      }
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `grafico-${chartTitle.replace(/\s+/g, '-').toLowerCase()}-${timestamp}`;

      if (format === 'png') {
        const canvas = await html2canvas(chartElement, { backgroundColor: '#ffffff', scale: 2, logging: false });
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `${filename}.png`;
        link.click();
        toast({ title: "Sucesso!", description: "Gráfico exportado como PNG" });
      } else if (format === 'svg') {
        const svg = chartElement.querySelector('svg');
        if (!svg) {
          toast({ title: "Erro", description: "SVG não encontrado no gráfico", variant: "destructive" });
          return;
        }
        const svgString = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}.svg`;
        link.click();
        URL.revokeObjectURL(link.href);
        toast({ title: "Sucesso!", description: "Gráfico exportado como SVG" });
      } else if (format === 'pdf') {
        const canvas = await html2canvas(chartElement, { backgroundColor: '#ffffff', scale: 2, logging: false });
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageH = pdf.internal.pageSize.getHeight();
        const imgData = canvas.toDataURL('image/png');
        let y = 10;
        pdf.setFontSize(14);
        pdf.text(chartTitle, 10, y);
        y += 15;
        while (heightLeft > 0) {
          const h = Math.min(pageH - 25, imgHeight);
          pdf.addImage(imgData, 'PNG', 10, y, imgWidth - 20, h);
          heightLeft -= h;
          if (heightLeft > 0) { pdf.addPage(); y = 10; }
        }
        pdf.save(`${filename}.pdf`);
        toast({ title: "Sucesso!", description: "Gráfico exportado como PDF" });
      }
    } catch {
      toast({ title: "Erro ao exportar", description: "Ocorreu um erro ao exportar o gráfico", variant: "destructive" });
    }
  };

  if (isGenerating) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center min-h-[60vh] text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="relative mb-8">
          <motion.div
            className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-semibold mb-2">Gerando seu gráfico...</h3>
        <p className="text-muted-foreground mb-4">Analisando dados e recomendando visualização</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">IA Ativa</Badge>
          Processando {selectedColumns.length} colunas
        </div>
      </motion.div>
    );
  }

  const colors = colorSchemes[colorScheme].colors;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBackToData}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar aos Dados
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Seu Gráfico</h2>
            <p className="text-muted-foreground">
              Visualizando {selectedColumns.length} colunas • {displayData.length} pontos de dados
              {AGGREGATE_TYPES.has(chartType) && data.rows.length > chartData.length && (
                <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                  (agregados de {data.rows.length.toLocaleString()} registros)
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            <Zap className="h-3 w-3 mr-1" />
            Recomendado pela IA
          </Badge>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Área do gráfico */}
        <motion.div
          className="lg:col-span-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{chartTitle}</span>
                <div className="flex gap-2">
                  {chartType === 'pivottable' ? (
                    <>
                      <Button variant="outline" size="sm" onClick={handleExportPivotCSV}>
                        <Download className="h-4 w-4 mr-2" />CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportPivotXLSX}>
                        <Download className="h-4 w-4 mr-2" />Excel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleExport('png')}>
                        <Download className="h-4 w-4 mr-2" />PNG
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleExport('svg')}>
                        <Download className="h-4 w-4 mr-2" />SVG
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                        <Download className="h-4 w-4 mr-2" />PDF
                      </Button>
                    </>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent id="chart-container" className="relative">
              {isPending && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-b-lg z-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
                </div>
              )}
              {/* Drill-down breadcrumb */}
              {drillPath.length > 0 && (
                <div className="flex items-center gap-1 text-sm mb-3 flex-wrap text-muted-foreground">
                  <button
                    type="button"
                    className="text-primary hover:underline font-medium"
                    onClick={() => setDrillPath([])}
                  >
                    {sortedGroupByCols[0] ?? 'Raíz'}
                  </button>
                  {drillPath.map((item, idx) => (
                    <Fragment key={item.field}>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => setDrillPath(prev => prev.slice(0, idx + 1))}
                      >
                        {item.value}
                      </button>
                    </Fragment>
                  ))}
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  <span>{activeGroupCols[0] ?? '…'}</span>
                </div>
              )}
              <ChartRenderer
                chartType={chartType}
                data={displayData}
                xField={xAxisTitle || xField}
                yField={yAxisTitle || yField}
                columns={selectedColumns}
                colors={colors}
                title={chartTitle}
                onDataPointClick={
                  AGGREGATE_TYPES.has(chartType) && sortedGroupByCols.length > 1
                    ? handleDataPointClick
                    : undefined
                }
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Painel de personalização */}
        <motion.div
          className="lg:col-span-1 space-y-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Personalização
              </CardTitle>
              <CardDescription>Customize sua visualização</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tipo de gráfico */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Tipo de Gráfico</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ALL_CHART_MODELS.map((model) => {
                    const isSelected = chartType === model.type;
                    const isRecommended = model.type === localRecommended;
                    const cardStatus = getCardinalityStatus(model, xCardinality);
                    const cardWarning = cardStatus === 'few'
                      ? `Poucos grupos (mín. ${model.cardinality!.min}, atual: ${xCardinality})`
                      : cardStatus === 'many'
                        ? `Muitos grupos (máx. ${model.cardinality!.max}, atual: ${xCardinality})`
                        : null;
                    return (
                      <button
                        key={model.type}
                        type="button"
                        onClick={() => handleChartTypeChange(model.type)}
                        title={cardWarning ? `${model.label} — ${cardWarning}` : model.label}
                        className={`relative flex flex-col items-center gap-1 rounded-lg border-2 px-1 py-2 text-center transition-all duration-150 hover:border-primary/60 hover:bg-primary/5 focus:outline-none ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-sm scale-[1.05]'
                            : cardStatus !== 'ok' && !isSelected
                              ? 'border-border bg-card opacity-60'
                              : 'border-border bg-card'
                        }`}
                      >
                        {isRecommended && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">
                            <Zap className="h-2 w-2" />
                          </span>
                        )}
                        {cardStatus !== 'ok' && (
                          <span className="absolute -bottom-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white">
                            !
                          </span>
                        )}
                        <span className="text-xl leading-none">{model.icon}</span>
                        <span className={`text-[10px] font-medium leading-tight ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                          {model.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {chartType === localRecommended && (
                  <Badge variant="outline" className="w-fit bg-primary/10 text-primary border-primary/30">
                    <Zap className="h-3 w-3 mr-1" />
                    Recomendado pela IA
                  </Badge>
                )}
              </div>

              <Separator />

              {/* Agregação e Filtros */}
              {AGGREGATE_TYPES.has(chartType) && (
                <div className="space-y-4">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Agregação e Filtros
                  </Label>
                  <div className="space-y-2">
                    <Label htmlFor="agg-mode" className="text-xs">Modo de Agregação</Label>
                    <Select value={aggMode} onValueChange={(v) => setAggMode(v as 'sum' | 'avg' | 'count' | 'max' | 'min')}>
                      <SelectTrigger id="agg-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sum">Soma (SUM)</SelectItem>
                        <SelectItem value="avg">Média (AVG)</SelectItem>
                        <SelectItem value="count">Contagem (COUNT)</SelectItem>
                        <SelectItem value="max">Máximo (MAX)</SelectItem>
                        <SelectItem value="min">Mínimo (MIN)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="top-n" className="text-xs">Top N (0 = todos)</Label>
                    <Input
                      id="top-n"
                      type="number"
                      min={0}
                      value={topN || ''}
                      placeholder="0 = todos"
                      onChange={(e) => setTopN(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                  {dateCol && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="date-from" className="text-xs">Data inicial</Label>
                        <Input
                          id="date-from"
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date-to" className="text-xs">Data final</Label>
                        <Input
                          id="date-to"
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <Separator />

              {/* Paleta de cores */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Paleta de Cores
                </Label>
                <Select value={colorScheme.toString()} onValueChange={(v) => setColorScheme(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorSchemes.map((scheme, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {scheme.colors.slice(0, 3).map((color) => (
                              <div key={color} className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                            ))}
                          </div>
                          {scheme.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Títulos */}
              <div className="space-y-4">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Títulos e Rótulos
                </Label>
                <div className="space-y-2">
                  <Label htmlFor="chart-title" className="text-xs">Título do Gráfico</Label>
                  <Input id="chart-title" value={chartTitle} onChange={(e) => setChartTitle(e.target.value)} placeholder="Digite o título..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="x-axis" className="text-xs">Campo X</Label>
                  <Input id="x-axis" value={xAxisTitle} onChange={(e) => setXAxisTitle(e.target.value)} placeholder={xField || "Eixo X"} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="y-axis" className="text-xs">Campo Y</Label>
                  <Input id="y-axis" value={yAxisTitle} onChange={(e) => setYAxisTitle(e.target.value)} placeholder={yField || "Eixo Y"} />
                </div>
              </div>

              <Separator />
              <Button variant="outline" className="w-full" onClick={onBackToUpload}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Novo Gráfico
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
