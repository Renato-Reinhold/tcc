import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { DataTable } from "@/components/DataTable";
import { ChartGenerator } from "@/components/ChartGenerator";
import { Header } from "@/components/Header";
import { DataSourceSelection } from "@/components/DataSourceSelection";
import { DatabaseConnection } from "@/components/DatabaseConnection";
import { DatabaseDiagram } from "@/components/DatabaseDiagram";
import { TableDetail } from "@/components/TableDetail";
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
}

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

  const handleGenerateChart = (columns: string[]) => {
    setSelectedColumns(columns);
    setCurrentStep('chart');
  };

  const handleBackToDiagram = () => {
    setCurrentStep('diagram');
  };

  const handleBackToData = () => {
    setCurrentStep('table');
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
                onBackToUpload={handleBackToUpload}
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
                data={processedData}
                onGenerateChart={handleGenerateChart}
                onBackToUpload={handleBackToUpload}
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