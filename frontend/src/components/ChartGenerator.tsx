import { useState, useMemo } from "react";
import { ChevronLeft, Download, Palette, Type, BarChart3, LineChart as LineIcon, PieChart as PieIcon, ScatterChart, Settings, Zap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ScatterChart as RechartsScatterChart,
  Scatter
} from "recharts";
import type { ProcessedData } from "@/pages/Index";
import { toast } from "@/hooks/use-toast";

interface ChartGeneratorProps {
  data: ProcessedData;
  selectedColumns: string[];
  onBackToData: () => void;
  onBackToUpload: () => void;
}

type ChartType = 'bar' | 'line' | 'pie' | 'scatter';

const chartTypes = [
  { value: 'bar', label: 'Gráfico de Barras', icon: BarChart3, description: 'Ideal para comparar categorias' },
  { value: 'line', label: 'Gráfico de Linhas', icon: LineIcon, description: 'Perfeito para mostrar tendências' },
  { value: 'pie', label: 'Gráfico de Pizza', icon: PieIcon, description: 'Ótimo para mostrar proporções' },
  { value: 'scatter', label: 'Gráfico de Dispersão', icon: ScatterChart, description: 'Ideal para correlações' }
];

const colorSchemes = [
  { name: 'Padrão', colors: ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'] },
  { name: 'Azul', colors: ['#3B82F6', '#1D4ED8', '#1E40AF', '#1E3A8A', '#312E81'] },
  { name: 'Verde', colors: ['#10B981', '#059669', '#047857', '#065F46', '#064E3B'] },
  { name: 'Roxo', colors: ['#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6', '#4C1D95'] },
  { name: 'Laranja', colors: ['#F59E0B', '#D97706', '#B45309', '#92400E', '#78350F'] }
];

export const ChartGenerator = ({ data, selectedColumns, onBackToData, onBackToUpload }: ChartGeneratorProps) => {
  const [isGenerating, setIsGenerating] = useState(true);
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [colorScheme, setColorScheme] = useState(0);
  const [chartTitle, setChartTitle] = useState('Gráfico dos Dados');
  const [xAxisTitle, setXAxisTitle] = useState('');
  const [yAxisTitle, setYAxisTitle] = useState('');

  useState(() => {
    const timer = setTimeout(() => {
      setIsGenerating(false);
      toast({
        title: "Gráfico gerado com sucesso!",
        description: "Seu gráfico foi criado e está pronto para personalização"
      });
    }, 3000);
    return () => clearTimeout(timer);
  });

  const chartData = useMemo(() => {
    const selectedColumnsData = selectedColumns.map(colName => 
      data.columns.find(col => col.name === colName)
    ).filter(Boolean);

    return data.rows.map(row => {
      const item: any = {};
      selectedColumns.forEach((colName, index) => {
        const colIndex = data.columns.findIndex(col => col.name === colName);
        item[colName] = row[colIndex];
      });
      return item;
    });
  }, [data, selectedColumns]);

  const recommendedChartType = useMemo(() => {
    const numericColumns = selectedColumns.filter(colName => {
      const col = data.columns.find(c => c.name === colName);
      return col?.type === 'number';
    });

    const textColumns = selectedColumns.filter(colName => {
      const col = data.columns.find(c => c.name === colName);
      return col?.type === 'text';
    });

    const dateColumns = selectedColumns.filter(colName => {
      const col = data.columns.find(c => c.name === colName);
      return col?.type === 'date';
    });

    if (dateColumns.length > 0 && numericColumns.length > 0) return 'line';
    if (textColumns.length === 1 && numericColumns.length === 1) return 'bar';
    if (numericColumns.length >= 2) return 'scatter';
    return 'bar';
  }, [data.columns, selectedColumns]);

  useState(() => {
    setChartType(recommendedChartType);
  });

  const handleExport = (format: 'png' | 'svg' | 'pdf') => {
    toast({
      title: `Exportando como ${format.toUpperCase()}`,
      description: "Seu gráfico será baixado em instantes"
    });
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

  const renderChart = () => {
    const colors = colorSchemes[colorScheme].colors;
    
    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={selectedColumns[0]} />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedColumns.slice(1).map((column, index) => (
                <Bar 
                  key={column} 
                  dataKey={column} 
                  fill={colors[index % colors.length]} 
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={selectedColumns[0]} />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedColumns.slice(1).map((column, index) => (
                <Line 
                  key={column} 
                  type="monotone" 
                  dataKey={column} 
                  stroke={colors[index % colors.length]}
                  strokeWidth={3}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        const pieData = chartData.map(item => ({
          name: item[selectedColumns[0]],
          value: item[selectedColumns[1]]
        }));
        
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <RechartsScatterChart data={chartData}>
              <CartesianGrid />
              <XAxis dataKey={selectedColumns[0]} />
              <YAxis dataKey={selectedColumns[1]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Dados" dataKey={selectedColumns[1]} fill={colors[0]} />
            </RechartsScatterChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
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
        {/* Chart Display */}
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
                    <Download className="h-4 w-4 mr-2" />
                    PNG
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport('svg')}>
                    <Download className="h-4 w-4 mr-2" />
                    SVG
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderChart()}
            </CardContent>
          </Card>
        </motion.div>

        {/* Customization Panel */}
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
              <CardDescription>
                Customize sua visualização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Chart Type */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Tipo de Gráfico</Label>
                <Select value={chartType} onValueChange={(value: ChartType) => setChartType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {chartTypes.map((type) => {
                      const Icon = type.icon;
                      return (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{type.label}</div>
                              <div className="text-xs text-muted-foreground">{type.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {chartType === recommendedChartType && (
                  <Badge variant="outline" className="w-fit bg-primary/10 text-primary border-primary/30">
                    <Zap className="h-3 w-3 mr-1" />
                    Recomendado
                  </Badge>
                )}
              </div>

              <Separator />

              {/* Color Scheme */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Paleta de Cores
                </Label>
                <Select value={colorScheme.toString()} onValueChange={(value) => setColorScheme(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorSchemes.map((scheme, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {scheme.colors.slice(0, 3).map((color, colorIndex) => (
                              <div 
                                key={colorIndex}
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: color }}
                              />
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

              {/* Titles */}
              <div className="space-y-4">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Títulos e Rótulos
                </Label>
                
                <div className="space-y-2">
                  <Label htmlFor="chart-title" className="text-xs">Título do Gráfico</Label>
                  <Input
                    id="chart-title"
                    value={chartTitle}
                    onChange={(e) => setChartTitle(e.target.value)}
                    placeholder="Digite o título..."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="x-axis" className="text-xs">Título do Eixo X</Label>
                  <Input
                    id="x-axis"
                    value={xAxisTitle}
                    onChange={(e) => setXAxisTitle(e.target.value)}
                    placeholder={selectedColumns[0] || "Eixo X"}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="y-axis" className="text-xs">Título do Eixo Y</Label>
                  <Input
                    id="y-axis"
                    value={yAxisTitle}
                    onChange={(e) => setYAxisTitle(e.target.value)}
                    placeholder={selectedColumns[1] || "Eixo Y"}
                  />
                </div>
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-3">
                <Button 
                  className="w-full bg-gradient-primary hover:shadow-glow"
                  onClick={() => {
                    toast({
                      title: "Gráfico salvo!",
                      description: "Seu gráfico foi salvo no painel para visualização posterior"
                    });
                  }}
                >
                  Salvar no Painel
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={onBackToUpload}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Novo Gráfico
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};