import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, Download, Palette, Type, Settings, Zap, ArrowLeft } from "lucide-react";
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
import type { ProcessedData } from "@/pages/Index";
import { toast } from "@/hooks/use-toast";
import { ChartRenderer } from "@/components/ChartRenderer";
import { ALL_CHART_MODELS } from "@/models/ChartRegistry";
import { normalizeChartType } from "@/types/chart";
import type { ChartType, DataValue } from "@/types/chart";

interface ChartGeneratorProps {
  data: ProcessedData;
  selectedColumns: string[];
  /** Tipo recomendado pelo backend (string livre) */
  recommendedType?: string;
  onBackToData: () => void;
  onBackToUpload: () => void;
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
    if (dateCols.length > 0 && numCols.length > 0) return 'line';
    if (numCols.length >= 2) return 'scatter';
    return 'bar';
  }, [recommendedType, selectedColumns, data.columns]);

  const [chartType, setChartType] = useState<ChartType>(localRecommended);

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

  // Dados mapeados para array de objetos
  const chartData = useMemo((): Array<Record<string, DataValue>> => {
    if (!data.rows || data.rows.length === 0) return [];

    return data.rows.map((row) => {
      const item: Record<string, DataValue> = {};
      // Support both array rows (CSV/DB) and object rows
      const isObjectRow =
        row !== null && typeof row === 'object' && !Array.isArray(row);

      selectedColumns.forEach((colName) => {
        let rawValue: unknown;
        if (isObjectRow) {
          rawValue = (row as Record<string, unknown>)[colName];
        } else {
          const colIndex = data.columns.findIndex((col) => col.name === colName);
          rawValue = colIndex >= 0 ? (row as unknown[])[colIndex] : undefined;
        }
        // Coerce numeric strings so Recharts scales work correctly
        if (
          typeof rawValue === 'string' &&
          rawValue.trim() !== '' &&
          !Number.isNaN(Number(rawValue))
        ) {
          item[colName] = Number(rawValue);
        } else {
          item[colName] = rawValue as DataValue;
        }
      });

      // When multiple GROUP BY columns exist, build a composite label for the X axis
      if (groupByCols.length > 1) {
        item['_x_label_'] = groupByCols
          .map((c) => String(item[c] ?? ''))
          .join(' / ');
      }

      return item;
    });
  }, [data, selectedColumns, groupByCols]);

  // xField: composite label when >1 group-by col, otherwise first group-by col
  const xField = groupByCols.length > 1 ? '_x_label_' : (groupByCols[0] ?? selectedColumns[0] ?? '');
  // yField: always the aggregation/value column
  const yField = valueCol;

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
              Visualizando {selectedColumns.length} colunas • {chartData.length} pontos de dados
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
                  <Button variant="outline" size="sm" onClick={() => handleExport('png')}>
                    <Download className="h-4 w-4 mr-2" />PNG
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport('svg')}>
                    <Download className="h-4 w-4 mr-2" />SVG
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                    <Download className="h-4 w-4 mr-2" />PDF
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent id="chart-container">
              <ChartRenderer
                chartType={chartType}
                data={chartData}
                xField={xAxisTitle || xField}
                yField={yAxisTitle || yField}
                columns={selectedColumns}
                colors={colors}
                title={chartTitle}
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
                    return (
                      <button
                        key={model.type}
                        type="button"
                        onClick={() => setChartType(model.type)}
                        title={model.label}
                        className={`relative flex flex-col items-center gap-1 rounded-lg border-2 px-1 py-2 text-center transition-all duration-150 hover:border-primary/60 hover:bg-primary/5 focus:outline-none ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-sm scale-[1.05]'
                            : 'border-border bg-card'
                        }`}
                      >
                        {isRecommended && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">
                            <Zap className="h-2 w-2" />
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
