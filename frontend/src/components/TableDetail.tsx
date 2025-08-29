import { useState } from "react";
import { ArrowLeft, Table, Database, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import type { ProcessedData } from "@/pages/Index";

interface TableDetailProps {
  data: ProcessedData;
  tableName: string;
  onBackToDiagram: () => void;
  onGenerateChart: (columns: string[]) => void;
}

export const TableDetail = ({ data, tableName, onBackToDiagram, onGenerateChart }: TableDetailProps) => {
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const totalPages = Math.ceil(data.rows.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRows = data.rows.slice(startIndex, endIndex);

  const toggleColumn = (columnName: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnName) 
        ? prev.filter(name => name !== columnName)
        : [...prev, columnName]
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'number': return '123';
      case 'date': return '📅';
      case 'text': return 'Aa';
      default: return '?';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'number': return 'bg-chart-2/10 text-chart-2 border-chart-2/30';
      case 'date': return 'bg-chart-3/10 text-chart-3 border-chart-3/30';
      case 'text': return 'bg-chart-1/10 text-chart-1 border-chart-1/30';
      default: return 'bg-muted/10 text-muted-foreground border-muted/30';
    }
  };

  const canGenerateChart = selectedColumns.length >= 2;

  const handleGenerateChart = () => {
    if (canGenerateChart) {
      onGenerateChart(selectedColumns);
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
          <Button variant="outline" onClick={onBackToDiagram}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Diagrama
          </Button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Table className="h-6 w-6" />
              {tableName}
            </h2>
            <p className="text-muted-foreground">
              {data.columns.length} colunas • {data.rows.length} registros • {selectedColumns.length} selecionadas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canGenerateChart ? (
            <Button 
              className="bg-gradient-primary hover:shadow-glow"
              onClick={handleGenerateChart}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Gerar Gráfico ({selectedColumns.length})
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" disabled>
                    <Circle className="h-4 w-4 mr-2" />
                    Selecione 2+ Colunas
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Selecione pelo menos 2 colunas para gerar um gráfico</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </motion.div>

      {/* Column Selection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Seleção de Colunas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.columns.map((column) => (
                <div
                  key={column.name}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedColumns.includes(column.name)
                      ? 'border-primary bg-primary/5 shadow-elegant'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                  onClick={() => toggleColumn(column.name)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox 
                      checked={selectedColumns.includes(column.name)}
                      onChange={() => toggleColumn(column.name)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">{column.name}</span>
                        <Badge variant="outline" className={`text-xs ${getTypeColor(column.type)}`}>
                          {getTypeIcon(column.type)} {column.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {column.data.length} valores únicos
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Table className="h-5 w-5" />
                Visualização dos Dados
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <div className="min-w-full">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      {data.columns.map((column) => (
                        <th
                          key={column.name}
                          className={`text-left p-3 font-medium cursor-pointer transition-colors ${
                            selectedColumns.includes(column.name)
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => toggleColumn(column.name)}
                        >
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className={`text-xs ${getTypeColor(column.type)}`}>
                                    {getTypeIcon(column.type)}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Tipo: {column.type}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <span>{column.name}</span>
                            {selectedColumns.includes(column.name) && (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b hover:bg-muted/30">
                        {data.columns.map((column, colIndex) => (
                          <td
                            key={column.name}
                            className={`p-3 ${
                              selectedColumns.includes(column.name)
                                ? 'bg-primary/5'
                                : ''
                            }`}
                          >
                            <span className="text-sm">
                              {row[colIndex] || '-'}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  {startIndex + 1}-{Math.min(endIndex, data.rows.length)} de {data.rows.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Próxima
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Selected Columns Summary */}
      {selectedColumns.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="shadow-card bg-gradient-to-r from-primary/5 to-accent/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                  <div>
                    <h4 className="font-semibold">Colunas Selecionadas</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedColumns.join(', ')}
                    </p>
                  </div>
                </div>
                <Button 
                  className="bg-gradient-primary hover:shadow-glow"
                  onClick={handleGenerateChart}
                  disabled={!canGenerateChart}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Gerar Gráfico
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};