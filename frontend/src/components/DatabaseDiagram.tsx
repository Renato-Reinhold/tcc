import { useCallback, useState, useMemo, useEffect } from "react";
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
  onViewTableData: (tableName: string, columns: string[]) => void;
  onGenerateChart: (columns: string[]) => void;
  onBackToUpload: () => void;
}

interface TableNodeData {
  label: string;
  columns: Array<{
    name: string;
    type: 'text' | 'number' | 'date';
  }>;
  recordCount: number;
  selectedColumns?: Set<string>;
  onViewData?: (tableName: string, columns: string[]) => void;
  onToggleColumn?: (tableName: string, columnName: string) => void;
}

const TableNode = ({ data }: { data: TableNodeData }) => {
  const handleViewData = () => {
    if (data.onViewData) {
      const columnNames = data.columns.map(col => col.name);
      data.onViewData(data.label, columnNames);
    }
  };

  const handleToggleColumn = (e: React.MouseEvent | React.KeyboardEvent, columnName: string) => {
    e.stopPropagation();
    if (data.onToggleColumn) {
      data.onToggleColumn(data.label, columnName);
    }
  };

  const selectedCount = data.selectedColumns?.size || 0;

  return (
    <div className="bg-card border border-border rounded-lg shadow-card min-w-[240px] hover:border-primary/50 transition-colors">
      <div className={`px-3 py-2 rounded-t-lg flex items-center justify-between bg-primary text-primary-foreground`}>
        <div className="flex items-center gap-2">
          <Table className="h-4 w-4" />
          <span className="font-semibold text-sm">{data.label}</span>
        </div>
        {selectedCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {selectedCount}
          </Badge>
        )}
      </div>
      <div className="p-3">
        <div className="space-y-1.5 mb-3">
          {data.columns.map((column, index) => {
            const isSelected = data.selectedColumns?.has(column.name) || false;
            return (
              <button
                key={index} 
                className={`w-full text-left flex items-center gap-2 p-1.5 rounded transition-all duration-200 transform ${
                  isSelected 
                    ? 'bg-primary/20 border-2 border-primary scale-105 shadow-sm' 
                    : 'hover:bg-muted/50 border border-transparent active:scale-95'
                }`}
                onClick={(e) => handleToggleColumn(e, column.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleToggleColumn(e as any, column.name);
                  }
                }}
              >
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                    isSelected 
                      ? 'bg-primary border-primary shadow-md' 
                      : 'border-muted-foreground/50 hover:border-primary/60'
                  }`}>
                    {isSelected && (
                      <span className="text-primary-foreground text-xs font-bold">✓</span>
                    )}
                  </div>
                  <span className={`font-medium text-xs truncate transition-colors ${
                    isSelected ? 'text-primary font-semibold' : 'text-foreground'
                  }`}>{column.name}</span>
                </div>
                <Badge 
                  variant="outline" 
                  className={`text-xs px-1 py-0 flex-shrink-0 ${
                    column.type === 'number' ? 'bg-chart-2/10 text-chart-2 border-chart-2/30' :
                    column.type === 'date' ? 'bg-chart-3/10 text-chart-3 border-chart-3/30' :
                    'bg-chart-1/10 text-chart-1 border-chart-1/30'
                  }`}
                >
                  {column.type}
                </Badge>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
          <span>{data.recordCount} registros</span>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-6 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              handleViewData();
            }}
          >
            <Eye className="h-3 w-3 mr-1" />
            Ver
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

export const DatabaseDiagram = ({ data, onTableSelect, onViewTableData, onGenerateChart, onBackToUpload }: DatabaseDiagramProps) => {
  const [tableSelections, setTableSelections] = useState<Record<string, Set<string>>>({});

  const handleToggleColumnInDiagram = useCallback((tableName: string, columnName: string) => {
    setTableSelections(prev => {
      const currentSelections = prev[tableName] || new Set();
      const newSelected = new Set(currentSelections);
      
      if (newSelected.has(columnName)) {
        newSelected.delete(columnName);
      } else {
        newSelected.add(columnName);
      }
      
      return {
        ...prev,
        [tableName]: newSelected
      };
    });
  }, []);

  const totalSelectedColumns = Object.values(tableSelections).reduce((sum, cols) => sum + cols.size, 0);
  
  const initialNodes: Node[] = useMemo(() => {
    if (data.metadata && Array.isArray(data.metadata.tables) && data.metadata.tables.length > 0) {
      const nodes = data.metadata.tables.map((table: any, index: number) => {
        return {
          id: `table-${index}`,
          type: 'table',
          position: { 
            x: (index % 3) * 350,
            y: Math.floor(index / 3) * 300
          },
          data: {
            label: table.name,
            columns: table.columns.map((col: any) => ({
              name: col.name,
              type: col.type === 'INTEGER' || col.type === 'NUMERIC' ? 'number' : 
                    col.type === 'DATE' || col.type === 'TIMESTAMP' ? 'date' : 'text'
            })),
            recordCount: table.record_count || table.row_count || 0,
            selectedColumns: tableSelections[table.name] || new Set(),
            onViewData: (tableName: string, columns: string[]) => {
              onViewTableData(tableName, columns);
            },
            onToggleColumn: handleToggleColumnInDiagram
          }
        };
      });
      return nodes;
    }

    const tables: any[] = [];
    

    if (data.metadata && data.metadata.tables && data.metadata.tables.length > 0) {
      data.metadata.tables.forEach((table: any, index: number) => {
        tables.push({
          id: `table-${index}`,
          type: 'table',
          position: { x: 100 + index * 350, y: 100 },
          data: {
            label: table.name,
            columns: table.columns.map((col: any) => ({
              name: col.name,
              type: col.type || 'text'
            })),
            recordCount: table.record_count || 0,
            selectedColumns: tableSelections[table.name] || new Set(),
            onViewData: (tableName: string, columns: string[]) => {
              onViewTableData(tableName, columns);
            },
            onToggleColumn: handleToggleColumnInDiagram
          }
        });
      });
    } else {
      tables.push({
        id: 'main-table',
        type: 'table',
        position: { x: 100, y: 100 },
        data: {
          label: data.tableName || 'Dados Principais',
          columns: data.columns.map(col => ({
            name: col.name,
            type: col.type
          })),
          recordCount: data.rows.length,
          selectedColumns: tableSelections[data.tableName || 'Dados Principais'] || new Set(),
          onViewData: (tableName: string, columns: string[]) => {
            onViewTableData(tableName, columns);
          },
          onToggleColumn: handleToggleColumnInDiagram
        }
      });
    }

    return tables;
  }, [data, onTableSelect, handleToggleColumnInDiagram, tableSelections]);

  const initialEdges: Edge[] = useMemo(() => {
    if (data.metadata && data.metadata.relationships && data.metadata.relationships.length > 0) {
      return data.metadata.relationships.map((rel: any, index: number) => {
        const sourceIndex = data.metadata?.tables.findIndex((t: any) => t.name === rel.source_table);
        const targetIndex = data.metadata?.tables.findIndex((t: any) => t.name === rel.target_table);
        
        if (sourceIndex >= 0 && targetIndex >= 0) {
          return {
            id: `rel-${index}`,
            source: `table-${sourceIndex}`,
            target: `table-${targetIndex}`,
            type: 'smoothstep',
            label: `${rel.source_column} → ${rel.target_column}`,
            style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
            animated: true,
          };
        }
        return null;
      }).filter((edge: any) => edge !== null);
    }

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
  }, [initialNodes, data]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(nds =>
      nds.map(node => {
        if (node.type === 'table' && typeof node.data?.label === 'string') {
          return {
            ...node,
            data: {
              ...node.data,
              selectedColumns: tableSelections[node.data.label] || new Set()
            }
          };
        }
        return node;
      })
    );
  }, [tableSelections, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleTableClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.id === 'main-table') {
      onTableSelect('main-table', data.columns.map(col => col.name));
    }
  }, [data.columns, onTableSelect]);

  const handleConfirmSelection = useCallback(() => {
    const allSelectedColumns = Array.from(
      Object.values(tableSelections).reduce((acc, columns) => {
        columns.forEach(col => acc.add(col));
        return acc;
      }, new Set<string>())
    );

    if (allSelectedColumns.length > 0) {
      onGenerateChart(allSelectedColumns);
    }
    
  }, [tableSelections, onGenerateChart]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
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
              Visualize a estrutura dos seus dados • Clique nas tabelas para selecionar colunas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalSelectedColumns > 0 && (
            <Badge className="bg-success/20 text-success border-success/30">
              {totalSelectedColumns} {totalSelectedColumns === 1 ? 'coluna selecionada' : 'colunas selecionadas'}
            </Badge>
          )}
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            {initialNodes.length} Tabelas
          </Badge>
          <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
            {data.rows.length} Registros
          </Badge>
          <Button 
            onClick={handleConfirmSelection}
            disabled={totalSelectedColumns === 0}
            className="ml-auto"
          >
            Selecionar Colunas
          </Button>
        </div>
      </motion.div>

      <div>
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
      </div>
    </div>
  );
};
