import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Database, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { ProcessedData } from "@/pages/Index";

interface DatabaseConnectionProps {
  onDataUploaded: (data: ProcessedData) => void;
  onBackToSource: () => void;
}

interface SupportedDatabase {
  type: string;
  name: string;
  default_port: string | null;
  description: string;
}

export const DatabaseConnection = ({ onDataUploaded, onBackToSource }: DatabaseConnectionProps) => {
  const [supportedDatabases, setSupportedDatabases] = useState<SupportedDatabase[]>([]);
  const [selectedDbType, setSelectedDbType] = useState<string>('postgresql');
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [customHost, setCustomHost] = useState('localhost');
  const [customPort, setCustomPort] = useState('5432');
  const [customDatabase, setCustomDatabase] = useState('');
  const [customUser, setCustomUser] = useState('postgres');
  const [customPassword, setCustomPassword] = useState('');

  // Carregar bancos suportados ao montar
  useEffect(() => {
    const loadSupportedDatabases = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/viz/databases/supported`);
        if (response.ok) {
          const data = await response.json();
          setSupportedDatabases(data.supported);
          // Atualizar porta padrão quando trocar tipo
          const selectedDb = data.supported.find((db: SupportedDatabase) => db.type === selectedDbType);
          if (selectedDb?.default_port) {
            setCustomPort(selectedDb.default_port);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar bancos suportados:", error);
      }
    };
    
    loadSupportedDatabases();
  }, []);

  const handleDatabaseTypeChange = (newType: string) => {
    setSelectedDbType(newType);
    // Atualizar porta padrão
    const selectedDb = supportedDatabases.find(db => db.type === newType);
    if (selectedDb?.default_port) {
      setCustomPort(selectedDb.default_port);
    }
    // Limpar credenciais padrão se mudar para SQLite
    if (newType === 'sqlite') {
      setCustomUser('');
      setCustomPassword('');
      setCustomHost('');
    } else {
      if (!customHost) setCustomHost('localhost');
      if (!customUser) setCustomUser('postgres');
    }
  };


  const handleCustomConnection = async () => {
    setIsConnecting(true);

    console.log("Testing custom connection to:", {
      db_type: selectedDbType,
      customHost,
      customPort,
      customDatabase,
      customUser
    });

    try {
      // Validar campos obrigatórios
      if (!customDatabase) {
        toast({
          title: "Campo obrigatório",
          description: "Database é obrigatório",
          variant: "destructive"
        });
        setIsConnecting(false);
        return;
      }

      if (selectedDbType !== 'sqlite' && (!customHost || !customUser)) {
        toast({
          title: "Campos obrigatórios",
          description: "Host e usuário são obrigatórios",
          variant: "destructive"
        });
        setIsConnecting(false);
        return;
      }
      
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      
      // Converter localhost para backend-db se necessário (Docker)
      let connectionHost = customHost;
      if (selectedDbType !== 'sqlite' && (customHost === 'localhost' || customHost === '127.0.0.1')) {
        connectionHost = 'backend-db';
        console.log("Converting localhost to backend-db for Docker connection");
      }
      
      // Testar conexão via novo endpoint
      const connectionPayload = {
        db_type: selectedDbType,
        host: selectedDbType !== 'sqlite' ? connectionHost : undefined,
        port: selectedDbType !== 'sqlite' ? customPort : undefined,
        database: customDatabase,
        user: selectedDbType !== 'sqlite' ? customUser : undefined,
        password: selectedDbType !== 'sqlite' ? customPassword : undefined
      };

      console.log("Connection payload:", connectionPayload);

      const connectionResponse = await fetch(`${backendUrl}/viz/databases/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectionPayload)
      });

      if (!connectionResponse.ok) {
        const errorData = await connectionResponse.json();
        throw new Error(errorData.detail || "Falha ao conectar com o banco de dados");
      }

      const connectionData = await connectionResponse.json();
      console.log("Connection successful:", connectionData);

      // Obter tabelas do banco conectado
      const tablesResponse = await fetch(`${backendUrl}/viz/databases/tables`);

      if (!tablesResponse.ok) {
        throw new Error("Falha ao obter tabelas do banco");
      }

      const tablesData = await tablesResponse.json();
      console.log("Tables data received:", tablesData);

      const mockData: ProcessedData = {
        columns: tablesData.tables.map((table: any) => ({
          name: table.name,
          type: 'text',
          data: table.columns.map((col: any) => col.name)
        })),
        rows: tablesData.tables.map((table: any) => [
          table.name,
          `${table.columns.length} colunas`,
          `Tabela do banco ${customDatabase}`
        ]),
        selectedColumns: [],
        metadata: {
          tables: tablesData.tables,
          relationships: []
        }
      };

      console.log("ProcessedData being sent to onDataUploaded:", mockData);

      toast({
        title: "Conexão estabelecida!",
        description: `Conectado a ${selectedDbType} com sucesso`
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
              {/* Database Type Selection */}
              <div className="space-y-4">
                <Label htmlFor="db-type" className="text-base font-medium">Tipo de Banco de Dados *</Label>
                <Select value={selectedDbType} onValueChange={handleDatabaseTypeChange}>
                  <SelectTrigger id="db-type">
                    <SelectValue placeholder="Selecione o tipo de banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedDatabases.map(db => (
                      <SelectItem key={db.type} value={db.type}>
                        <div className="flex flex-col">
                          <span className="font-medium">{db.name}</span>
                          <span className="text-xs text-muted-foreground">{db.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Connection Fields */}
              {selectedDbType !== 'sqlite' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="host">Host *</Label>
                    <Input
                      id="host"
                      value={customHost}
                      onChange={(e) => setCustomHost(e.target.value)}
                      placeholder="localhost ou backend-db"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use "backend-db" para PostgreSQL em Docker
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Porta</Label>
                    <Input
                      id="port"
                      value={customPort}
                      onChange={(e) => setCustomPort(e.target.value)}
                      placeholder={supportedDatabases.find(db => db.type === selectedDbType)?.default_port || "5432"}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="database">Nome do Banco *</Label>
                <Input
                  id="database"
                  value={customDatabase}
                  onChange={(e) => setCustomDatabase(e.target.value)}
                  placeholder={selectedDbType === 'sqlite' ? 'database.db' : 'nome_banco'}
                />
              </div>

              {selectedDbType !== 'sqlite' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user">Usuário *</Label>
                    <Input
                      id="user"
                      value={customUser}
                      onChange={(e) => setCustomUser(e.target.value)}
                      placeholder="postgres"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              {/* Connection Button */}
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleCustomConnection}
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
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};