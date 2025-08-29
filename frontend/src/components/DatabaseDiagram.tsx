import { useCallback, useState, useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Table, Eye, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import type { ProcessedData } from "@/pages/Index";

interface DatabaseDiagramProps {
  data: ProcessedData;
  onTableSelect: (tableName: string, columns: string[]) => void;
  onBackToUpload: () => void;
}

interface TableNodeData {
  label: string;
  columns: Array<{
    name: string;
    type: 'text' | 'number' | 'date';
  }>;
  recordCount: number;
}

// Custom Table Node Component
const TableNode = ({ data }: { data: TableNodeData }) => {
  return (
    <div className="bg-card border border-border rounded-lg shadow-card min-w-[200px]">
      <div className="bg-primary text-primary-foreground px-3 py-2 rounded-t-lg flex items-center gap-2">
        <Table className="h-4 w-4" />
        <span className="font-semibold text-sm">{data.label}</span>
      </div>
      <div className="p-3">
        <div className="space-y-1 mb-3">
          {data.columns.map((column, index) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <span className="font-medium">{column.name}</span>
              <Badge 
                variant="outline" 
                className={`text-xs px-1 py-0 ${
                  column.type === 'number' ? 'bg-chart-2/10 text-chart-2 border-chart-2/30' :
                  column.type === 'date' ? 'bg-chart-3/10 text-chart-3 border-chart-3/30' :
                  'bg-chart-1/10 text-chart-1 border-chart-1/30'
                }`}
              >
                {column.type}
              </Badge>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{data.recordCount} registros</span>
          <Button size="sm" variant="outline" className="h-6 text-xs">
            <Eye className="h-3 w-3 mr-1" />
            Ver Dados
          </Button>
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
};

const nodeTypes = {
  table: TableNode,
};

export const DatabaseDiagram = ({ data, onTableSelect, onBackToUpload }: DatabaseDiagramProps) => {
  // Transform data into table nodes
  const initialNodes: Node[] = useMemo(() => {
    // Simulate multiple tables based on data structure
    const tables = [
      {
        id: 'main-table',
        type: 'table',
        position: { x: 100, y: 100 },
        data: {
          label: 'Dados Principais',
          columns: data.columns.map(col => ({
            name: col.name,
            type: col.type
          })),
          recordCount: data.rows.length
        }
      }
    ];

    // Add related tables if we have enough columns
    if (data.columns.length > 4) {
      const midPoint = Math.floor(data.columns.length / 2);
      tables.push({
        id: 'related-table-1',
        type: 'table',
        position: { x: 400, y: 50 },
        data: {
          label: 'Tabela Relacionada A',
          columns: data.columns.slice(0, midPoint).map(col => ({
            name: col.name,
            type: col.type
          })),
          recordCount: Math.floor(data.rows.length * 0.8)
        }
      });

      tables.push({
        id: 'related-table-2',
        type: 'table',
        position: { x: 400, y: 250 },
        data: {
          label: 'Tabela Relacionada B',
          columns: data.columns.slice(midPoint).map(col => ({
            name: col.name,
            type: col.type
          })),
          recordCount: Math.floor(data.rows.length * 0.6)
        }
      });
    }

    return tables;
  }, [data]);

  const initialEdges: Edge[] = useMemo(() => {
    if (initialNodes.length <= 1) return [];
    
    return [
      {
        id: 'e1-2',
        source: 'main-table',
        target: 'related-table-1',
        type: 'smoothstep',
        style: { stroke: 'hsl(var(--primary))' },
        animated: true,
      },
      {
        id: 'e1-3',
        source: 'main-table',
        target: 'related-table-2',
        type: 'smoothstep',
        style: { stroke: 'hsl(var(--accent))' },
        animated: true,
      }
    ];
  }, [initialNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleTableClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.id === 'main-table') {
      onTableSelect('main-table', data.columns.map(col => col.name));
    }
  }, [data.columns, onTableSelect]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBackToUpload}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Database className="h-6 w-6" />
              Diagrama do Banco de Dados
            </h2>
            <p className="text-muted-foreground">
              Visualize a estrutura dos seus dados • Clique nas tabelas para explorar
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            {initialNodes.length} Tabelas
          </Badge>
          <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
            {data.rows.length} Registros
          </Badge>
        </div>
      </motion.div>

      {/* Database Diagram */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Estrutura do Banco de Dados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[600px] border border-border rounded-lg overflow-hidden">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={handleTableClick}
                nodeTypes={nodeTypes}
                fitView
                style={{ backgroundColor: "hsl(var(--muted))" }}
                className="cursor-pointer"
              >
                <Controls />
                <MiniMap 
                  zoomable 
                  pannable 
                  style={{ backgroundColor: "hsl(var(--card))" }}
                />
                <Background gap={12} size={1} />
              </ReactFlow>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Instructions */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-gradient-primary text-primary-foreground">
          <CardContent className="p-4 text-center">
            <Eye className="h-8 w-8 mx-auto mb-2" />
            <h3 className="font-semibold mb-1">Explore as Tabelas</h3>
            <p className="text-sm opacity-90">Clique nas tabelas para ver os dados detalhados</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-accent text-accent-foreground">
          <CardContent className="p-4 text-center">
            <Table className="h-8 w-8 mx-auto mb-2" />
            <h3 className="font-semibold mb-1">Selecione Colunas</h3>
            <p className="text-sm opacity-90">Escolha as colunas para gerar gráficos</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <Database className="h-8 w-8 mx-auto mb-2 text-success" />
            <h3 className="font-semibold mb-1">Relacionamentos</h3>
            <p className="text-sm text-muted-foreground">Veja como os dados se conectam</p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};