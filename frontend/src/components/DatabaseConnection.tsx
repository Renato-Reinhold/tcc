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

const DB_ICONS: Record<string, string> = {
  postgresql: "🐘",
  mysql:      "🐬",
  mssql:      "🪟",
  sqlite:     "📦",
  oracle:     "🔴",
};

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

// Static fallback so the dropdown is never empty even when the API is unreachable
const FALLBACK_DATABASES: SupportedDatabase[] = [
  { type: 'postgresql', name: 'PostgreSQL',   default_port: '5432', description: 'PostgreSQL' },
  { type: 'mysql',      name: 'MySQL',         default_port: '3306', description: 'MySQL' },
  { type: 'mssql',      name: 'SQL Server',    default_port: '1433', description: 'Microsoft SQL Server' },
  { type: 'sqlite',     name: 'SQLite',        default_port: null,   description: 'SQLite' },
  { type: 'oracle',     name: 'Oracle',        default_port: '1521', description: 'Oracle Database' },
];

export const DatabaseConnection = ({ onDataUploaded, onBackToSource }: DatabaseConnectionProps) => {
  const [supportedDatabases, setSupportedDatabases] = useState<SupportedDatabase[]>(FALLBACK_DATABASES);
  const [selectedDbType, setSelectedDbType] = useState<string>('postgresql');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  const [customHost, setCustomHost] = useState('');
  const [customPort, setCustomPort] = useState('5432');
  const [customDatabase, setCustomDatabase] = useState('');
  const [customUser, setCustomUser] = useState('');
  const [customPassword, setCustomPassword] = useState('');

  useEffect(() => {
    const loadSupportedDatabases = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/viz/databases/supported`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.supported) && data.supported.length > 0) {
            setSupportedDatabases(data.supported);
          }
          const selectedDb = (data.supported ?? FALLBACK_DATABASES).find(
            (db: SupportedDatabase) => db.type === selectedDbType
          );
          if (selectedDb?.default_port) {
            setCustomPort(selectedDb.default_port);
          }
        }
      } catch {
        // Keep the FALLBACK_DATABASES already in state
      }
    };
    
    loadSupportedDatabases();
  }, []);

  const handleDatabaseTypeChange = (newType: string) => {
    setSelectedDbType(newType);
    const selectedDb = supportedDatabases.find(db => db.type === newType);
    if (selectedDb?.default_port) {
      setCustomPort(selectedDb.default_port);
    }
    if (newType === 'sqlite') {
      setCustomUser('');
      setCustomPassword('');
      setCustomHost('');
      setCustomPort('');
    }
  };


  const buildConnectionPayload = () => ({
    db_type: selectedDbType,
    host: selectedDbType !== 'sqlite' ? customHost : undefined,
    port: selectedDbType !== 'sqlite' ? customPort : undefined,
    database: customDatabase,
    user: selectedDbType !== 'sqlite' ? customUser : undefined,
    password: selectedDbType !== 'sqlite' ? customPassword : undefined,
  });

  const validateFields = (): boolean => {
    if (!customDatabase) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do banco de dados é obrigatório.",
        variant: "destructive"
      });
      return false;
    }
    if (selectedDbType !== 'sqlite' && (!customHost || !customUser)) {
      toast({
        title: "Campos obrigatórios",
        description: "Host e usuário são obrigatórios.",
        variant: "destructive"
      });
      return false;
    }
    return true;
  };

  const handleTestConnection = async () => {
    if (!validateFields()) return;
    setIsTesting(true);
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/viz/databases/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildConnectionPayload())
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Falha ao conectar com o banco de dados");
      }
      toast({
        title: "Conexão bem-sucedida!",
        description: `Conexão com ${selectedDbType} testada com sucesso.`
      });
    } catch (error: any) {
      toast({
        title: "Falha na conexão",
        description: error.message || "Não foi possível conectar ao banco de dados.",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCustomConnection = async () => {
    if (!validateFields()) return;
    setIsConnecting(true);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const connectionPayload = buildConnectionPayload();

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

      const tablesResponse = await fetch(`${backendUrl}/viz/databases/tables`);

      if (!tablesResponse.ok) {
        throw new Error("Falha ao obter tabelas do banco");
      }

      const tablesData = await tablesResponse.json();

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
        source: 'database',
        metadata: {
          tables: tablesData.tables,
          relationships: tablesData.relationships || []
        }
      };

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
              <div className="space-y-2">
                <Label htmlFor="db-type">Tipo de Banco de Dados *</Label>
                <Select value={selectedDbType} onValueChange={handleDatabaseTypeChange}>
                  <SelectTrigger id="db-type">
                    <SelectValue placeholder="Selecione o banco de dados" />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedDatabases.map(db => (
                      <SelectItem key={db.type} value={db.type}>
                        <span className="flex items-center gap-2">
                          <span>{DB_ICONS[db.type] ?? '🗄️'}</span>
                          <span>{db.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
{selectedDbType !== 'sqlite' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="host">Host *</Label>
                    <Input
                      id="host"
                      value={customHost}
                      onChange={(e) => setCustomHost(e.target.value)}
                      placeholder="endereço do servidor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Porta</Label>
                    <Input
                      id="port"
                      value={customPort}
                      onChange={(e) => setCustomPort(e.target.value)}
                      placeholder="porta"
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
                  placeholder={selectedDbType === 'sqlite' ? 'caminho do arquivo .db' : 'nome do banco de dados'}
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
                      placeholder="nome de usuário"
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
<div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  size="lg"
                  onClick={handleTestConnection}
                  disabled={isTesting || isConnecting}
                >
                  {isTesting ? (
                    <motion.div
                      className="flex items-center gap-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <motion.div
                        className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      Testando...
                    </motion.div>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Testar Conexão
                    </>
                  )}
                </Button>
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={handleCustomConnection}
                  disabled={isConnecting || isTesting}
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
                      Conectar
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
