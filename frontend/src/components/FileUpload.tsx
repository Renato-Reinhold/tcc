import { useCallback, useState } from "react";
import { Upload, FileText, Table, Database, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import type { ProcessedData } from "@/pages/Index";
import heroImage from "@/assets/hero-charts.jpg";

interface FileUploadProps {
  onDataUploaded: (data: ProcessedData) => void;
  onBackToSource: () => void;
}

export const FileUpload = ({ onDataUploaded, onBackToSource }: FileUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (file.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter menos de 50MB",
        variant: "destructive"
      });
      return;
    }

    const validTypes = ['.csv', '.xlsx', '.json'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      toast({
        title: "Tipo de arquivo não suportado",
        description: "Apenas arquivos CSV, XLSX e JSON são aceitos",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Simulate file processing with mock data
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock processed data for demo
      const mockData: ProcessedData = {
        columns: [
          { name: 'Data', type: 'date', data: ['2024-01', '2024-02', '2024-03', '2024-04'] },
          { name: 'Vendas', type: 'number', data: [1200, 1800, 1500, 2100] },
          { name: 'Produto', type: 'text', data: ['A', 'B', 'A', 'B'] },
          { name: 'Região', type: 'text', data: ['Norte', 'Sul', 'Norte', 'Sul'] }
        ],
        rows: [
          ['2024-01', 1200, 'A', 'Norte'],
          ['2024-02', 1800, 'B', 'Sul'],
          ['2024-03', 1500, 'A', 'Norte'],
          ['2024-04', 2100, 'B', 'Sul']
        ],
        selectedColumns: []
      };
      
      toast({
        title: "Arquivo processado com sucesso!",
        description: `${mockData.rows.length} linhas e ${mockData.columns.length} colunas detectadas`
      });
      
      onDataUploaded(mockData);
    } catch (error) {
      toast({
        title: "Erro ao processar arquivo",
        description: "Verifique se o arquivo está no formato correto",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [onDataUploaded]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  }, [handleFiles]);

  if (isProcessing) {
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
            <Database className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-semibold mb-2">Analisando seus dados...</h3>
        <p className="text-muted-foreground">Detectando colunas e tipos de dados</p>
      </motion.div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back Button */}
      <motion.div 
        className="mb-6"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Button 
          variant="ghost" 
          onClick={onBackToSource}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para seleção de fonte
        </Button>
      </motion.div>

      {/* Hero Section */}
      <motion.div 
        className="text-center mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="relative mb-8 overflow-hidden rounded-2xl shadow-elegant">
          <img 
            src={heroImage}
            alt="Visualização de dados profissional com gráficos e dashboards modernos"
            className="w-full h-64 md:h-80 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-accent/80 flex items-center justify-center">
            <div className="text-center text-white">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Visualize seus dados em segundos
              </h1>
              <p className="text-xl md:text-2xl opacity-90">
                IA inteligente • Upload rápido • Gráficos profissionais
              </p>
            </div>
          </div>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Faça upload de seus arquivos CSV, XLSX ou JSON e deixe nossa IA recomendar 
          automaticamente as melhores visualizações para seus dados
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <Card className="shadow-card border-2 border-dashed border-border hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Adicionar Dados
            </CardTitle>
            <CardDescription>
              Arraste e solte seu arquivo ou clique para selecionar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/30'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".csv,.xlsx,.json"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-primary/10">
                  <Upload className="h-12 w-12 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    {dragActive ? 'Solte seu arquivo aqui' : 'Clique ou arraste seu arquivo'}
                  </h3>
                  <p className="text-muted-foreground">
                    Suporte para CSV, XLSX e JSON (até 50MB)
                  </p>
                </div>
                <Button variant="outline" className="mt-2">
                  Selecionar Arquivo
                </Button>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <FileText className="h-8 w-8 text-chart-1" />
                <div>
                  <div className="font-medium">CSV</div>
                  <div className="text-sm text-muted-foreground">Dados tabulares</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <Table className="h-8 w-8 text-chart-2" />
                <div>
                  <div className="font-medium">XLSX</div>
                  <div className="text-sm text-muted-foreground">Planilhas Excel</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <Database className="h-8 w-8 text-chart-3" />
                <div>
                  <div className="font-medium">JSON</div>
                  <div className="text-sm text-muted-foreground">Dados estruturados</div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                Exemplo de dados
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Não tem dados? Experimente com nosso arquivo de exemplo.
              </p>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => {
                  // Load sample data
                  const sampleData: ProcessedData = {
                    columns: [
                      { name: 'Mês', type: 'text', data: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'] },
                      { name: 'Receita', type: 'number', data: [45000, 52000, 48000, 61000, 55000, 67000] },
                      { name: 'Despesas', type: 'number', data: [38000, 41000, 39000, 44000, 42000, 48000] },
                      { name: 'Lucro', type: 'number', data: [7000, 11000, 9000, 17000, 13000, 19000] }
                    ],
                    rows: [
                      ['Jan', 45000, 38000, 7000],
                      ['Fev', 52000, 41000, 11000],
                      ['Mar', 48000, 39000, 9000],
                      ['Abr', 61000, 44000, 17000],
                      ['Mai', 55000, 42000, 13000],
                      ['Jun', 67000, 48000, 19000]
                    ],
                    selectedColumns: []
                  };
                  onDataUploaded(sampleData);
                }}
              >
                Usar dados de exemplo
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};