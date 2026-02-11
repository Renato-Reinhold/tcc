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
import { motion, AnimatePresence } from "framer-motion";

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
    }>;
  };
}

// Função auxiliar para processar dados de uma tabela específica
const getTableData = (data: ProcessedData, tableName: string, selectedColumns: string[]): ProcessedData => {
  console.log("getTableData - Input:", { tableName, rowCount: data.rows?.length, columnCount: data.columns?.length });
  
  if (!data) {
    return data;
  }

  // Os dados já vêm do backend, apenas retornar com os selectedColumns atualizados
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
    console.log("handleViewTableData called with:", { tableName, columnsLength: columns.length });
    
    try {
      let updatedData: ProcessedData;

      // Se os dados já estão em processedData (arquivo upload), usar os dados locais
      if (processedData && processedData.rows && processedData.rows.length > 0) {
        console.log("Using local data from processedData");
        
        // Filtrar colunas se necessário
        let filteredColumns = processedData.columns;
        if (columns.length > 0) {
          filteredColumns = processedData.columns.filter(col => columns.includes(col.name));
        }

        updatedData = {
          ...processedData,
          columns: filteredColumns,
          selectedColumns: columns
        };
      } else {
        // Se não há dados locais, buscar do backend (banco de dados)
        console.log("Fetching data from backend");
        const response = await queryService.getTableData(tableName);
        console.log("Table data received:", response);
        
        // Converter dados do backend (array de objetos) para array de arrays
        const rows = response.data ? response.data.map((row: any) => 
          response.columns.map((col: string) => row[col])
        ) : [];
        
        // Converter colunas para o formato esperado
        const formattedColumns = response.columns.map((colName: string) => ({
          name: colName,
          type: 'text' as const, // Por padrão text, pode ser refinado depois
          data: []
        }));

        updatedData = {
          ...processedData!,
          columns: formattedColumns,
          rows: rows,
          selectedColumns: columns
        };
      }
      
      console.log("Formatted table data:", { tableName, rowCount: updatedData.rows.length, columnCount: updatedData.columns.length });
      
      setProcessedData(updatedData);
      setSelectedTable(tableName);
      setSelectedColumns(columns);
      setCurrentStep('data');
    } catch (error) {
      console.error("Erro ao buscar dados da tabela:", error);
    }
  };

  const handleGenerateChart = (columns: string[]) => {
    setSelectedColumns(columns);
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
                onBackToData={handleBackToData}
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