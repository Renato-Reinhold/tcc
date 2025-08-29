import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Database } from "lucide-react";

interface DataSourceSelectionProps {
  onSelectFileUpload: () => void;
  onSelectDatabase: () => void;
}

export const DataSourceSelection = ({ onSelectFileUpload, onSelectDatabase }: DataSourceSelectionProps) => {
  return (
    <div className="container mx-auto px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-bold text-text-primary mb-4">
          Como você gostaria de adicionar seus dados?
        </h1>
        <p className="text-lg text-text-secondary max-w-2xl mx-auto">
          Escolha a fonte dos seus dados para começar a criar gráficos inteligentes
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="h-full hover-scale cursor-pointer transition-all duration-300 hover:shadow-elegant border-border/50"
                onClick={onSelectFileUpload}>
            <CardHeader className="text-center pb-6">
              <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Upload de Arquivo</CardTitle>
              <CardDescription className="text-base">
                Envie seus arquivos CSV, XLSX ou JSON diretamente
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-sm text-text-secondary space-y-2 mb-6">
                <li>✓ Suporte a CSV, XLSX e JSON</li>
                <li>✓ Até 50MB por arquivo</li>
                <li>✓ Processamento instantâneo</li>
                <li>✓ Arrastar e soltar</li>
              </ul>
              <Button className="w-full" size="lg">
                Escolher Arquivo
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="h-full hover-scale cursor-pointer transition-all duration-300 hover:shadow-elegant border-border/50"
                onClick={onSelectDatabase}>
            <CardHeader className="text-center pb-6">
              <div className="mx-auto w-16 h-16 bg-gradient-secondary rounded-full flex items-center justify-center mb-4">
                <Database className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Conectar Banco de Dados</CardTitle>
              <CardDescription className="text-base">
                Conecte diretamente com seu banco de dados
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-sm text-text-secondary space-y-2 mb-6">
                <li>✓ PostgreSQL, MySQL</li>
                <li>✓ Consultas em tempo real</li>
                <li>✓ Dados sempre atualizados</li>
                <li>✓ Configuração simples</li>
              </ul>
              <Button variant="secondary" className="w-full" size="lg">
                Configurar Conexão
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="text-center mt-12"
      >
        <p className="text-sm text-text-secondary">
          Não tem dados para testar? 
          <button 
            onClick={onSelectFileUpload}
            className="text-primary hover:underline ml-1 font-medium"
          >
            Use nossos dados de exemplo
          </button>
        </p>
      </motion.div>
    </div>
  );
};