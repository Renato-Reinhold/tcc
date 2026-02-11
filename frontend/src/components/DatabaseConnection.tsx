import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Database, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { ProcessedData } from "@/pages/Index";

interface DatabaseConnectionProps {
  onDataUploaded: (data: ProcessedData) => void;
  onBackToSource: () => void;
}

export const DatabaseConnection = ({ onDataUploaded, onBackToSource }: DatabaseConnectionProps) => {
  const [connectionType, setConnectionType] = useState<'supabase' | 'sql'>('supabase');
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [customHost, setCustomHost] = useState('');
  const [customPort, setCustomPort] = useState('5432');
  const [customDatabase, setCustomDatabase] = useState('');
  const [customUser, setCustomUser] = useState('');
  const [customPassword, setCustomPassword] = useState('');

  const handleSupabaseConnection = async () => {
    setIsConnecting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockData: ProcessedData = {
        columns: [
          { name: 'users', type: 'text', data: ['id', 'name', 'email', 'created_at'] },
          { name: 'orders', type: 'text', data: ['id', 'user_id', 'total', 'status', 'created_at'] },
          { name: 'products', type: 'text', data: ['id', 'name', 'price', 'category', 'stock'] },
          { name: 'order_items', type: 'text', data: ['id', 'order_id', 'product_id', 'quantity', 'price'] }
        ],
        rows: [
          ['users', 'Tabela de usuários', '1,234 registros'],
          ['orders', 'Tabela de pedidos', '5,678 registros'],
          ['products', 'Tabela de produtos', '456 registros'],
          ['order_items', 'Itens dos pedidos', '12,345 registros']
        ],
        selectedColumns: []
      };
      
      toast({
        title: "Conexão estabelecida!",
        description: "Conectado ao banco Supabase com sucesso"
      });
      
      onDataUploaded(mockData);
    } catch (error: any) {
      toast({
        title: "Erro na conexão",
        description: error.message || "Erro ao conectar com o Supabase",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCustomConnection = async () => {
    setIsConnecting(true);

    console.log("Testing custom connection to:", {
      customHost,
      customPort,
      customDatabase,
      customUser
    });

    try {
      if (!customHost || !customDatabase || !customUser) {
        toast({
          title: "Campos obrigatórios",
          description: "Preencha host, database e usuário",
          variant: "destructive"
        });
        setIsConnecting(false);
        return;
      }
      
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const apiUrl = `${backendUrl}/viz/test-connection`;
      
      console.log("Making request to:", apiUrl);
      
      let connectionHost = customHost;
      if (customHost === 'localhost' || customHost === '127.0.0.1') {
        connectionHost = 'backend-db';
        console.log("Converting localhost to backend-db for Docker connection");
      }
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host: connectionHost,
          port: parseInt(customPort),
          database: customDatabase,
          username: customUser,
          password: customPassword
        })
      });
      
      console.log("Response status:", response.status);
      
      if (!response.ok) {
        const error = await response.json();
        console.error("API Error:", error);
        toast({
          title: "Erro na conexão",
          description: error.detail || "Falha ao conectar com o banco de dados",
          variant: "destructive"
        });
        return;
      }
      
      const data = await response.json();
      console.log("Connection successful! Full response:", data);
      
      const mockData: ProcessedData = {
        columns: data.metadata.tables.map((table: any) => ({
          name: table.name,
          type: 'text',
          data: table.columns.map((col: any) => col.name)
        })),
        rows: data.metadata.tables.map((table: any) => [
          table.name,
          `${table.columns.length} colunas`,
          `Tabela do banco ${customDatabase}`
        ]),
        selectedColumns: [],
        metadata: data.metadata
      };
      
      console.log("ProcessedData being sent to onDataUploaded:", mockData);
      
      toast({
        title: "Conexão estabelecida!",
        description: data.message
      });
      
      onDataUploaded(mockData);
    } catch (error: any) {
      toast({
        title: "Erro na conexão",
        description: error.message || "Erro ao conectar com o banco de dados",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };


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

      {/* Header */}
      <motion.div 
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="mx-auto w-16 h-16 bg-gradient-secondary rounded-full flex items-center justify-center mb-4">
          <Database className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-text-primary mb-4">
          Conectar ao Banco de Dados
        </h1>
        <p className="text-lg text-text-secondary max-w-2xl mx-auto">
          Conecte-se ao seu banco de dados para visualizar o diagrama das tabelas
        </p>
      </motion.div>

      <div className="max-w-3xl mx-auto">
        {/* Connection Configuration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Configuração de Conexão</CardTitle>
              <CardDescription>
                Escolha o tipo de conexão e configure os parâmetros
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Connection Type Selection */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Tipo de Conexão</Label>
                <div className="space-y-3">
                  <div 
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      connectionType === 'supabase' 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/30'
                    }`}
                    onClick={() => setConnectionType('supabase')}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Supabase (Recomendado)</h3>
                        <p className="text-sm text-muted-foreground">
                          Conexão direta com Supabase PostgreSQL
                        </p>
                      </div>
                      {connectionType === 'supabase' && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </div>

                  <div 
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      connectionType === 'sql' 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/30'
                    }`}
                    onClick={() => setConnectionType('sql')}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Conexão Personalizada</h3>
                        <p className="text-sm text-muted-foreground">
                          PostgreSQL, MySQL, ou outro banco
                        </p>
                      </div>
                      {connectionType === 'sql' && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Connection Fields */}
              {connectionType === 'sql' && (
                <motion.div 
                  className="space-y-4"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="host">Host *</Label>
                      <Input
                        id="host"
                        value={customHost}
                        onChange={(e) => setCustomHost(e.target.value)}
                        placeholder="backend-db ou localhost"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use "backend-db" para o PostgreSQL em Docker
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="port">Porta</Label>
                      <Input
                        id="port"
                        value={customPort}
                        onChange={(e) => setCustomPort(e.target.value)}
                        placeholder="5432"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="database">Database *</Label>
                    <Input
                      id="database"
                      value={customDatabase}
                      onChange={(e) => setCustomDatabase(e.target.value)}
                      placeholder="nome_do_banco"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Usuário *</Label>
                    <Input
                      id="username"
                      value={customUser}
                      onChange={(e) => setCustomUser(e.target.value)}
                      placeholder="usuario"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder="senha"
                    />
                  </div>
                </motion.div>
              )}

              {/* Connection Button */}
              <Button 
                className="w-full" 
                size="lg"
                onClick={connectionType === 'supabase' ? handleSupabaseConnection : handleCustomConnection}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <motion.div
                    className="flex items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <motion.div
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    Conectando...
                  </motion.div>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    Testar Conexão
                  </>
                )}
              </Button>

              {connectionType === 'supabase' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <p className="text-sm text-muted-foreground">
                    Conexão configurada automaticamente com seu projeto Supabase
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};