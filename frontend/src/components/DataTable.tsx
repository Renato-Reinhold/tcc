import { useState, useMemo } from "react";
import { ChevronLeft, BarChart3, Info, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import type { ProcessedData } from "@/pages/Index";
import { toast } from "@/hooks/use-toast";
import { colTypeLabel, colTypeClass, colTypeDescription } from "@/lib/inferColumnType";

interface DataTableProps {
  data: ProcessedData;
  tableName?: string;
  initialColumns?: string[];
  onGenerateChart: (selectedColumns: string[]) => void;
  onBackToUpload: () => void;
}

export const DataTable = ({ data, tableName, initialColumns = [], onGenerateChart, onBackToUpload }: DataTableProps) => {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(initialColumns);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const displayColumns = data.columns || [];

  const tableRows = useMemo(() => {
    if (!data.rows || data.rows.length === 0) {
      return [];
    }

    if (Array.isArray(data.rows[0]) && data.columns && data.columns.length > 0) {
      return data.rows.map(row => {
        const obj: any = {};
        data.columns.forEach((col, idx) => {
          obj[col.name] = Array.isArray(row) ? row[idx] : row[col.name];
        });
        return obj;
      });
    }
    
    return data.rows || [];
  }, [data.rows, data.columns]);

  const totalPages = Math.ceil(tableRows.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentRows = tableRows.slice(startIndex, endIndex);

  const toggleColumn = (columnName: string) => {
    setSelectedColumns(prev => {
      if (prev.includes(columnName)) {
        return prev.filter(col => col !== columnName);
      } else {
        return [...prev, columnName];
      }
    });
  };

  const canGenerateChart = selectedColumns.length >= 2;

  const handleGenerateChart = () => {
    if (!canGenerateChart) {
      toast({
        title: "Selecione pelo menos 2 colunas",
        description: "É necessário selecionar ao menos duas colunas para gerar um gráfico",
        variant: "destructive"
      });
      return;
    }
    onGenerateChart(selectedColumns);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBackToUpload}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Selecione as Colunas</h2>
            <p className="text-muted-foreground">
              {tableRows.length} linhas • {displayColumns.length} colunas detectadas
            </p>
          </div>
        </div>
        <Button 
          onClick={handleGenerateChart}
          disabled={!canGenerateChart}
          className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Gerar Gráfico
          {selectedColumns.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {selectedColumns.length}
            </Badge>
          )}
        </Button>
      </motion.div>

      {/* Instructions */}
      <motion.div 
        className="p-4 rounded-lg bg-primary/5 border border-primary/20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-medium mb-1">Como selecionar colunas</h3>
            <p className="text-sm text-muted-foreground">
              Clique nos cabeçalhos das colunas para selecioná-las. 
              São necessárias pelo menos 2 colunas para gerar um gráfico. 
              Passe o mouse sobre os cabeçalhos para ver o tipo de dado detectado.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Preview dos Dados</CardTitle>
            <CardDescription>
              Mostrando {currentRows.length} de {tableRows.length} linhas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      {displayColumns.map((column) => (
                        <Tooltip key={column.name}>
                          <TooltipTrigger asChild>
                            <th
                              className={`
                                p-3 text-left cursor-pointer transition-all duration-200
                                ${selectedColumns.includes(column.name) 
                                  ? 'bg-primary/10 border-2 border-primary rounded-t-lg' 
                                  : 'hover:bg-muted/50'
                                }
                              `}
                              onClick={() => toggleColumn(column.name)}
                            >
                              <div className="flex items-center gap-2">
                                {selectedColumns.includes(column.name) && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                                <span className="font-medium">{column.name}</span>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${colTypeClass(column.type)}`}
                                >
                                  {colTypeLabel(column.type)}
                                </Badge>
                              </div>
                            </th>
                          </TooltipTrigger>
                          <TooltipContent>
                              <div className="text-sm">
                              <div className="font-medium">{column.name}</div>
                              <div className="text-muted-foreground">
                                Tipo: {colTypeDescription(column.type)}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((row, rowIndex) => (
                      <motion.tr 
                        key={rowIndex}
                        className="border-b hover:bg-muted/30 transition-colors"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: rowIndex * 0.02 }}
                      >
                        {displayColumns.map((column) => (
                          <td 
                            key={column.name}
                            className={`
                              p-3 text-sm
                              ${selectedColumns.includes(column.name)
                                ? 'bg-primary/5 border-x border-primary/20'
                                : ''
                              }
                            `}
                          >
                            {row && row[column.name] !== undefined ? String(row[column.name]) : '-'}
                          </td>
                        ))}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                    >
                      Anterior
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                    >
                      Próximo
                    </Button>
                  </div>
                </div>
              )}
            </TooltipProvider>
          </CardContent>
        </Card>
      </motion.div>

      {/* Selected Columns Summary */}
      {selectedColumns.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium mb-1">Colunas Selecionadas</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedColumns.map(column => (
                      <Badge key={column} variant="secondary" className="gap-1">
                        <Check className="h-3 w-3" />
                        {column}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button 
                  onClick={handleGenerateChart}
                  disabled={!canGenerateChart}
                  className="bg-gradient-primary hover:shadow-glow"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
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
