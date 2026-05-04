import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { DataTable } from "@/components/DataTable";
import { ChartGenerator } from "@/components/ChartGenerator";
import { Header } from "@/components/Header";
import { DataSourceSelection } from "@/components/DataSourceSelection";
import { DatabaseConnection } from "@/components/DatabaseConnection";
import { DatabaseDiagram } from "@/components/DatabaseDiagram";
import { TableDetail } from "@/components/TableDetail";
import { queryService } from "@/services/queryService";
import type { QueryModel, AggregationFunction, Filter } from "@/types/query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";

export interface DataColumn {
  name: string;
  type: 'text' | 'number' | 'date';
  data: any[];
}

export interface ProcessedData {
  columns: DataColumn[];
  rows: any[][];
  selectedColumns: string[];
  tableName?: string;
  source?: 'file' | 'database';
  metadata?: {
    tables: Array<{
      name: string;
      columns: Array<{
        name: string;
        type: string;
      }>;
      row_count?: number;
      record_count?: number;
    }>;
    relationships?: Array<{
      source_table: string;
      source_column: string;
      target_table: string;
      target_column: string;
      type?: 'fk' | 'index';
    }>;
  };
}

/**
 * Infer a DataColumn type from actual data values (used for DB columns
 * which come back from the API without explicit type info).
 */
function detectColType(data: Record<string, unknown>[], colName: string): 'text' | 'number' | 'date' {
  const sample = data.slice(0, 20).map((r) => r[colName]).filter((v) => v != null);
  if (sample.length === 0) return 'text';
  if (sample.every((v) => typeof v === 'number')) return 'number';
  if (
    sample.every(
      (v) => typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))
    )
  )
    return 'number';
  if (
    sample.some(
      (v) =>
        typeof v === 'string' &&
        /^\d{4}-\d{2}-\d{2}/.test(v)
    )
  )
    return 'date';
  return 'text';
}

/** Find which metadata table owns the most of the requested columns. */
function findOwnerTable(
  tables: Array<{ name: string; columns: Array<{ name: string; type: string } | string> }> | undefined,
  columns: string[]
): string | undefined {
  if (!tables) return undefined;
  let bestTable: string | undefined;
  let bestCount = 0;
  for (const t of tables) {
    const count = columns.filter((col) =>
      t.columns.some((c) => (typeof c === 'string' ? c === col : c.name === col))
    ).length;
    if (count > bestCount) {
      bestCount = count;
      bestTable = t.name;
    }
  }
  return bestTable;
}

const getTableData = (data: ProcessedData, tableName: string, selectedColumns: string[]): ProcessedData => {
  if (!data) {
    return data;
  }

  return {
    ...data,
    selectedColumns: selectedColumns || data.selectedColumns || []
  };
};

type Step = 'source' | 'upload' | 'database' | 'diagram' | 'table' | 'data' | 'chart';

const Index = () => {
  const [currentStep, setCurrentStep] = useState<Step>('source');
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [recommendedChartType, setRecommendedChartType] = useState<string | undefined>(undefined);
  const [diagramNodePositions, setDiagramNodePositions] = useState<Record<string, { x: number; y: number }>>({});

  const handleSelectFileUpload = () => {
    setCurrentStep('upload');
  };

  const handleSelectDatabase = () => {
    setCurrentStep('database');
  };

  const handleDataUploaded = (data: ProcessedData) => {
    setProcessedData(data);
    setCurrentStep('diagram');
  };

  const handleTableSelect = (tableName: string, columns: string[]) => {
    setSelectedTable(tableName);
    setSelectedColumns(columns);
    setCurrentStep('table');
  };

  const handleViewTableData = async (tableName: string, columns: string[]) => {
    try {
      let updatedData: ProcessedData;

      const isFromDatabase = processedData?.source === 'database';
      const isFromFile = processedData?.source === 'file';

      if (isFromDatabase) {
        const response = await queryService.getTableData(tableName);
        
        const rows = response.data ? response.data.map((row: any) => 
          response.columns.map((col: string) => row[col])
        ) : [];
        
        // Detect proper column types from actual data values
        const formattedColumns = response.columns.map((colName: string) => ({
          name: colName,
          type: detectColType(response.data || [], colName),
          data: [] as any[],
        }));

        updatedData = {
          ...processedData,
          columns: formattedColumns,
          rows: rows,
          tableName: tableName,
          selectedColumns: columns,
          source: 'database'
        };
      } else if (isFromFile) {
        let filteredColumns = processedData.columns;
        if (columns.length > 0) {
          filteredColumns = processedData.columns.filter(col => columns.includes(col.name));
        }

        updatedData = {
          ...processedData,
          columns: filteredColumns,
          selectedColumns: columns,
          source: 'file'
        };
      } else {
        let filteredColumns = processedData.columns;
        if (columns.length > 0) {
          filteredColumns = processedData.columns.filter(col => columns.includes(col.name));
        }

        updatedData = {
          ...processedData,
          columns: filteredColumns,
          selectedColumns: columns
        };
      }
      
      setProcessedData(updatedData);
      setSelectedTable(tableName);
      setSelectedColumns(columns);
      setCurrentStep('data');
    } catch (error) {
    }
  };

  const handleGenerateChart = async (
    columns: string[],
    chartType?: string,
    tableHint?: string,
    queryOverride?: {
      groupBy: string[];
      aggField: string;
      aggFunc: string;
      filters: Array<{ field: string; op: string; value: string }>;
      tables?: string[];
      granularity?: string;
    }
  ) => {
    if (columns.length === 0) return;

    if (processedData?.source === 'database') {
      // ── Database source: use /viz/execute so ChartQueryBuilder shapes the data ──
      const ownerTable =
        tableHint ||
        selectedTable ||
        findOwnerTable(processedData.metadata?.tables, columns);

      if (!ownerTable) {
        toast({
          title: 'Tabela não encontrada',
          description: 'Não foi possível identificar a tabela dos dados selecionados.',
          variant: 'destructive',
        });
        return;
      }

      // When tableHint is provided the columns are already scoped to that table.
      // Otherwise filter to only those columns that belong to ownerTable.
      let effectiveColumns = columns;
      if (!tableHint) {
        const ownerMeta = processedData.metadata?.tables.find((t) => t.name === ownerTable);
        const ownerColumnNames = new Set(
          ownerMeta?.columns.map((c) => (typeof c === 'string' ? c : c.name)) ?? []
        );
        if (ownerColumnNames.size > 0) {
          const filtered = columns.filter((c) => ownerColumnNames.has(c));
          if (filtered.length > 0) effectiveColumns = filtered;
        }
      }

      try {
        const requestedType = chartType || 'bar';

        // Build group_by and aggregations from queryOverride (from the diagram builder)
        // or auto-detect from column types.
        const getColType = (c: string) =>
          processedData.columns.find((dc) => dc.name === c)?.type;

        const xCol = effectiveColumns.find((c) => getColType(c) !== 'number') ?? effectiveColumns[0];
        const yCol = effectiveColumns.find((c) => getColType(c) === 'number') ?? '';

        const qGroupBy: string[] =
          queryOverride?.groupBy.length ? queryOverride.groupBy : [xCol];
        const qAggField: string =
          queryOverride === undefined ? yCol : queryOverride.aggField;
        const qAggFunc: AggregationFunction =
          (queryOverride?.aggFunc as AggregationFunction) ?? (yCol ? 'sum' : 'count');
        const qFilters: Filter[] | undefined =
          queryOverride?.filters
            .filter((f) => f.field && f.value !== '')
            .map((f) => ({
              field: f.field,
              operator: f.op as Filter['operator'],
              value: f.value,
            }));

        const queryTables =
          queryOverride?.tables && queryOverride.tables.length > 1
            ? queryOverride.tables
            : [ownerTable];

        const queryModel: QueryModel = {
          source_type: 'database',
          tables: queryTables,
          base_table: ownerTable,
          group_by: qGroupBy,
          aggregations: [{ field: qAggField, func: qAggFunc, alias: qAggField || 'valor' }],
          filters: qFilters,
          chart_type: requestedType,
        };

        const response = await queryService.executeQuery(queryModel);
        const responseColumns = response.result.columns;

        const newColumns = responseColumns.map((colName) => ({
          name: colName,
          type: detectColType(response.result.data, colName),
          data: [] as any[],
        }));

        // Store rows as objects — ChartGenerator.chartData handles this with isObjectRow
        setProcessedData({
          ...processedData,
          columns: newColumns,
          rows: response.result.data as any[][],
          tableName: ownerTable,
          selectedColumns: responseColumns,
          source: 'database',
        });
        setSelectedTable(ownerTable);
        setSelectedColumns(responseColumns);
        setRecommendedChartType(response.recommendation.chart_type);
        setCurrentStep('chart');
      } catch {
        toast({
          title: 'Erro ao gerar gráfico',
          description: 'Não foi possível buscar os dados do banco de dados.',
          variant: 'destructive',
        });
      }
      return;
    }

    // ── File source: data already in processedData.rows ──────────────────────
    setSelectedColumns(columns);
    if (chartType) setRecommendedChartType(chartType);
    setCurrentStep('chart');
  };

  const handleBackToDiagram = () => {
    setCurrentStep('diagram');
  };

  const handleBackToData = () => {
    setCurrentStep('data');
  };

  const handleBackToUpload = () => {
    setCurrentStep('upload');
    setProcessedData(null);
    setSelectedColumns([]);
    setSelectedTable('');
  };

  const handleBackToSource = () => {
    setCurrentStep('source');
    setProcessedData(null);
    setSelectedColumns([]);
    setSelectedTable('');
  };

  return (
    <div className="min-h-screen bg-gradient-bg">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {currentStep === 'source' && (
            <motion.div
              key="source"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DataSourceSelection 
                onSelectFileUpload={handleSelectFileUpload}
                onSelectDatabase={handleSelectDatabase}
              />
            </motion.div>
          )}

          {currentStep === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <FileUpload 
                onDataUploaded={handleDataUploaded} 
                onBackToSource={handleBackToSource}
              />
            </motion.div>
          )}

          {currentStep === 'database' && (
            <motion.div
              key="database"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DatabaseConnection 
                onDataUploaded={handleDataUploaded}
                onBackToSource={handleBackToSource}
              />
            </motion.div>
          )}

          {currentStep === 'diagram' && processedData && (
            <motion.div
              key="diagram"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DatabaseDiagram 
                data={processedData}
                onTableSelect={handleTableSelect}
                onViewTableData={handleViewTableData}
                onGenerateChart={handleGenerateChart}
                onBackToUpload={handleBackToSource}
                nodePositions={diagramNodePositions}
                onNodePositionsChange={setDiagramNodePositions}
              />
            </motion.div>
          )}

          {currentStep === 'table' && processedData && (
            <motion.div
              key="table"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <TableDetail 
                data={processedData}
                tableName={selectedTable}
                onBackToDiagram={handleBackToDiagram}
                onGenerateChart={handleGenerateChart}
              />
            </motion.div>
          )}

          {currentStep === 'data' && processedData && (
            <motion.div
              key="data"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DataTable 
                data={getTableData(processedData, selectedTable, selectedColumns)}
                tableName={selectedTable}
                initialColumns={selectedColumns}
                onGenerateChart={handleGenerateChart}
                onBackToUpload={handleBackToDiagram}
              />
            </motion.div>
          )}
          
          {currentStep === 'chart' && processedData && (
            <motion.div
              key="chart"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ChartGenerator 
                data={processedData}
                selectedColumns={selectedColumns}
                recommendedType={recommendedChartType}
                onBackToData={handleBackToDiagram}
                onBackToUpload={handleBackToUpload}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Index;