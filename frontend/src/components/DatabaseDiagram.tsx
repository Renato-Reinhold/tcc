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
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Table, Eye, Database, Plus, Trash2, Code2, Play, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import type { ProcessedData } from "@/pages/Index";
import { colTypeLabel, colTypeClass } from "@/lib/inferColumnType";

interface FilterRow {
  id: number;
  field: string;
  op: string;
  value: string;
}

interface QueryOverride {
  groupBy: string[];
  aggField: string;
  aggFunc: string;
  filters: FilterRow[];
  tables: string[];
  granularity: string;
}

interface DatabaseDiagramProps {
  data: ProcessedData;
  onTableSelect: (tableName: string, columns: string[]) => void;
  onViewTableData: (tableName: string, columns: string[]) => void;
  onGenerateChart: (columns: string[], chartType?: string, tableHint?: string, queryOverride?: QueryOverride) => void;
  onBackToUpload: () => void;
  nodePositions?: Record<string, { x: number; y: number }>;
  onNodePositionsChange?: (positions: Record<string, { x: number; y: number }>) => void;
}

// ── Module-level FK graph helpers ───────────────────────────────────────────
type FkAdj = Record<string, Array<{ to: string; fromCol: string; toCol: string }>>;

/** BFS shortest path from start → end through the FK adjacency graph. Returns null if unreachable. */
function bfsPath(
  adj: FkAdj,
  start: string,
  end: string,
): Array<{ from: string; to: string; fromCol: string; toCol: string }> | null {
  if (start === end) return [];
  const visited = new Set([start]);
  const queue: Array<{ node: string; path: Array<{ from: string; to: string; fromCol: string; toCol: string }> }> = [
    { node: start, path: [] },
  ];
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    for (const edge of (adj[item.node] ?? [])) {
      if (!visited.has(edge.to)) {
        const newPath = [...item.path, { from: item.node, to: edge.to, fromCol: edge.fromCol, toCol: edge.toCol }];
        if (edge.to === end) return newPath;
        visited.add(edge.to);
        queue.push({ node: edge.to, path: newPath });
      }
    }
  }
  return null; // unreachable
}

/** BFS from multiple start nodes; returns all reachable table names (including starts). */
function bfsReachable(adj: FkAdj, starts: string[]): Set<string> {
  const visited = new Set<string>(starts);
  const queue = [...starts];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const edge of (adj[current] ?? [])) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
  return visited;
}

interface TableNodeData {
  label: string;
  columns: Array<{
    name: string;
    type: string;
  }>;
  recordCount: number;
  selectedColumns?: Set<string>;
  tableDisabled?: boolean;
  noFkLink?: boolean;
  onViewData?: (tableName: string, columns: string[]) => void;
  onToggleColumn?: (tableName: string, columnName: string) => void;
}

const TableNode = ({ data }: { data: TableNodeData }) => {
  const noFkLink = data.noFkLink ?? false;

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
    <div className={`bg-card border rounded-lg shadow-card min-w-[240px] transition-colors ${
      noFkLink ? 'border-yellow-500/40' : 'border-border hover:border-primary/50'
    }`}>
      <div className="px-3 py-2 rounded-t-lg flex items-center justify-between bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <Table className="h-4 w-4" />
          <span className="font-semibold text-sm">{data.label}</span>
          {noFkLink && (
            <AlertCircle
              className="h-3.5 w-3.5 text-yellow-300"
            />
          )}
        </div>
        {selectedCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {selectedCount}
          </Badge>
        )}
      </div>
      <div className="p-3">
        {noFkLink && (
          <div className="flex items-center gap-1.5 mb-2 px-1 py-1 rounded bg-yellow-500/10 border border-yellow-500/30">
            <AlertCircle className="h-3 w-3 text-yellow-600 flex-shrink-0" />
            <span className="text-[10px] text-yellow-700 dark:text-yellow-400 leading-tight">
              Sem FK — pode haver impacto no desempenho
            </span>
          </div>
        )}
        <div className="space-y-1.5 mb-3">
          {data.columns.map((column, index) => {
            const isSelected = data.selectedColumns?.has(column.name) || false;
            return (
              <button
                key={index}
                className={(() => {
                  const base = 'w-full text-left flex items-center gap-2 p-1.5 rounded transition-all duration-200 transform';
                  if (isSelected) return `${base} bg-primary/20 border-2 border-primary scale-105 shadow-sm`;
                  return `${base} hover:bg-muted/50 border border-transparent active:scale-95`;
                })()
                }
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
                  className={`text-xs px-1 py-0 flex-shrink-0 ${colTypeClass(column.type)}`}
                >
                  {colTypeLabel(column.type)}
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

export const DatabaseDiagram = ({ data, onTableSelect, onViewTableData, onGenerateChart, onBackToUpload, nodePositions, onNodePositionsChange }: DatabaseDiagramProps) => {
  const [tableSelections, setTableSelections] = useState<Record<string, Set<string>>>({});

  // ── Query builder state ─────────────────────────────────────────────────────
  const [groupByCols, setGroupByCols] = useState<string[]>([]);
  const [aggFunc, setAggFunc] = useState<string>('count');
  const [aggField, setAggField] = useState<string>('');
  const [filterRows, setFilterRows] = useState<FilterRow[]>([]);
  const [nextFilterId, setNextFilterId] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [granularity, setGranularity] = useState<'none'|'year'|'month'|'week'|'day'>('none');

  // ── Dominant table (most selected columns) ──────────────────────────────────
  const dominantTable = useMemo(() => {
    let name = '';
    let maxSize = 0;
    for (const [table, cols] of Object.entries(tableSelections)) {
      if (cols.size > maxSize) { name = table; maxSize = cols.size; }
    }
    return name;
  }, [tableSelections]);

  // All selected columns across all tables, with type info from metadata
  const allSelectedCols = useMemo(() => {
    const result: Array<{ table: string; name: string; type: string }> = [];
    for (const [tableName, cols] of Object.entries(tableSelections)) {
      if (cols.size === 0) continue;
      const tableMeta = data.metadata?.tables?.find((t: { name: string }) => t.name === tableName);
      for (const col of cols) {
        const colMeta = tableMeta?.columns?.find((c: { name: string }) => c.name === col);
        result.push({ table: tableName, name: col, type: colMeta?.type ?? '' });
      }
    }
    return result;
  }, [tableSelections, data.metadata]);

  const isNumericCol = useCallback((colName: string) => {
    const col = allSelectedCols.find((c) => c.name === colName);
    if (!col) return false;
    const t = col.type.toUpperCase();
    return (
      t === 'NUMBER' || // file-inferred type
      t.includes('INT') || t.includes('NUMERIC') || t.includes('DECIMAL') ||
      t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('REAL') || t.includes('MONEY')
    );
  }, [allSelectedCols]);

  const isDateCol = useCallback((colName: string) => {
    const col = allSelectedCols.find((c) => c.name === colName);
    const t = col?.type.toUpperCase() ?? '';
    return t === 'DATE' || t.includes('DATE') || t.includes('TIMESTAMP') || t.includes('TIME');
  }, [allSelectedCols]);

  // All tables that have at least one selected column
  const allSelectedTables = useMemo(
    () => Object.keys(tableSelections).filter((t) => (tableSelections[t]?.size ?? 0) > 0),
    [tableSelections]
  );

  // ── Build undirected FK adjacency over ALL tables (for transitive path finding) ──
  const fkAdj = useMemo<FkAdj>(() => {
    const adj: FkAdj = {};
    if (!data.metadata?.relationships) return adj;
    for (const rel of data.metadata.relationships as Array<{
      source_table: string; source_column: string; target_table: string; target_column: string
    }>) {
      if (!adj[rel.source_table]) adj[rel.source_table] = [];
      if (!adj[rel.target_table]) adj[rel.target_table] = [];
      adj[rel.source_table].push({ to: rel.target_table, fromCol: rel.source_column, toCol: rel.target_column });
      adj[rel.target_table].push({ to: rel.source_table, fromCol: rel.target_column, toCol: rel.source_column });
    }
    return adj;
  }, [data.metadata]);

  // ── Transitive JOIN path finder ──────────────────────────────────────────────
  // Returns { clauses, intermediates } where intermediates are tables in the join
  // path that the user didn't explicitly select columns from.
  const joinPathResult = useMemo<{ clauses: string[]; intermediates: string[] }>(() => {
    if (allSelectedTables.length <= 1 || !dominantTable) return { clauses: [], intermediates: [] };
    const extraTables = allSelectedTables.filter((t) => t !== dominantTable);
    const edgeKey = (a: string, b: string) => (a < b ? `${a}\u2194${b}` : `${b}\u2194${a}`);
    const addedEdges = new Set<string>();
    const clauses: string[] = [];
    const intermediateTables = new Set<string>();
    for (const target of extraTables) {
      const path = bfsPath(fkAdj, dominantTable, target);
      if (!path) continue; // no FK path — skip (table was already validated as reachable)
      for (const edge of path) {
        const key = edgeKey(edge.from, edge.to);
        if (!addedEdges.has(key)) {
          addedEdges.add(key);
          clauses.push(`JOIN ${edge.to} ON ${edge.from}.${edge.fromCol} = ${edge.to}.${edge.toCol}`);
        }
        // If this node in the path has no user-selected columns it's an intermediate table
        if (!allSelectedTables.includes(edge.to)) {
          intermediateTables.add(edge.to);
        }
      }
    }
    return { clauses, intermediates: [...intermediateTables] };
  }, [dominantTable, allSelectedTables, fkAdj]);

  // ── Tables reachable (via any FK path) from the currently selected tables ───
  // null → nothing selected yet → no restriction
  // Used only for the warning indicator — tables are never blocked
  const reachableFromSelected = useMemo<Set<string> | null>(() => {
    if (allSelectedTables.length === 0) return null;
    if (data.source === 'file') return null; // Files have no FK relationships
    return bfsReachable(fkAdj, allSelectedTables);
  }, [fkAdj, allSelectedTables, data.source]);

  // Stable key to detect selection changes
  const selectionsKey = useMemo(
    () => Object.entries(tableSelections)
      .map(([t, cols]) => `${t}:${[...cols].sort((a, b) => a.localeCompare(b)).join(',')}`).join('|'),
    [tableSelections]
  );

  // Auto-reset query config when selection changes
  useEffect(() => {
    const catCols = allSelectedCols.filter((c) => !isNumericCol(c.name)).map((c) => c.name);
    const numCols = allSelectedCols.filter((c) => isNumericCol(c.name)).map((c) => c.name);
    const hasDateCol = catCols.some((c) => isDateCol(c));
    setGroupByCols(catCols.length > 0 ? catCols : []);
    setAggField(numCols.length > 0 ? numCols[0] : '');
    setAggFunc(numCols.length > 0 ? 'sum' : 'count');
    setFilterRows([]);
    setGranularity(hasDateCol ? 'month' : 'none');
  }, [selectionsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateFilterField = useCallback((id: number, field: string) =>
    setFilterRows((rows) => rows.map((r) => r.id === id ? { ...r, field } : r)), []);
  const updateFilterOp = useCallback((id: number, op: string) =>
    setFilterRows((rows) => rows.map((r) => r.id === id ? { ...r, op } : r)), []);
  const updateFilterValue = useCallback((id: number, value: string) =>
    setFilterRows((rows) => rows.map((r) => r.id === id ? { ...r, value } : r)), []);
  const removeFilter = useCallback((id: number) =>
    setFilterRows((rows) => rows.filter((r) => r.id !== id)), []);

  const sqlPreview = useMemo(() => {
    if (!dominantTable) return '-- selecione colunas para montar a consulta';
    const multiTable = allSelectedTables.length > 1;
    const qualifyCol = (col: { table: string; name: string }) =>
      multiTable ? `${col.table}.${col.name}` : col.name;
    const wrapGranularity = (expr: string, colName: string) => {
      if (granularity === 'none' || !isDateCol(colName)) return expr;
      if (granularity === 'year') return `EXTRACT(YEAR FROM ${expr})`;
      return `DATE_TRUNC('${granularity}', ${expr})`;
    };
    const gbCols = groupByCols.filter(Boolean);
    const gbExprs = gbCols.map((c) => {
      const found = allSelectedCols.find((sc) => sc.name === c);
      const qualified = found ? qualifyCol(found) : c;
      return wrapGranularity(qualified, c);
    });
    const aggColMeta = allSelectedCols.find((c) => c.name === aggField);
    const aggColQualified = aggColMeta ? qualifyCol(aggColMeta) : aggField;
    const aggCountExpr = 'COUNT(*) AS valor';
    const aggFieldExpr = `${aggFunc.toUpperCase()}(${aggColQualified}) AS valor`;
    const aggExpr = aggFunc === 'count' || !aggField ? aggCountExpr : aggFieldExpr;
    const selectParts = gbExprs.length > 0
      ? `${gbExprs.join(',\n       ')},\n       ${aggExpr}`
      : aggExpr;
    const joinsStr = joinPathResult.clauses.length > 0 ? '\n' + joinPathResult.clauses.join('\n') : '';
    const opMap: Record<string, string> = { eq: '=', gt: '>', lt: '<', gte: '>=', lte: '<=', like: 'LIKE' };
    const validFilters = filterRows.filter((f) => f.field && f.value !== '');
    const where = validFilters.length > 0
      ? '\nWHERE ' + validFilters.map((f) => {
          const found = allSelectedCols.find((c) => c.name === f.field);
          const qField = found ? qualifyCol(found) : f.field;
          const op = opMap[f.op] ?? '=';
          if (f.op === 'like') return `${qField} LIKE '%${f.value}%'`;
          const val = Number.isNaN(Number(f.value)) ? `'${f.value}'` : f.value;
          return `${qField} ${op} ${val}`;
        }).join('\n  AND ')
      : '';
    const groupByClause = gbExprs.length > 0 ? `\nGROUP BY ${gbExprs.join(', ')}` : '';
    const orderByClause = gbExprs.length > 0 ? '\nORDER BY valor DESC' : '';
    return `SELECT ${selectParts}\nFROM ${dominantTable}${joinsStr}${where}${groupByClause}${orderByClause}`;
  }, [dominantTable, allSelectedTables, allSelectedCols, joinPathResult, groupByCols, aggFunc, aggField, filterRows, granularity, isDateCol]);

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
          position: nodePositions?.[`table-${index}`] ?? { 
            x: (index % 3) * 430,
            y: Math.floor(index / 3) * 400
          },
          data: {
            label: table.name,
            columns: table.columns.map((col: any) => {
              const raw: string = col.type ?? 'text';
              // Already a normalized FileColType — pass through unchanged
              if (raw === 'number' || raw === 'date' || raw === 'boolean' || raw === 'geo' || raw === 'text') {
                return { name: col.name, type: raw };
              }
              // SQL type from DB metadata — convert to display type
              const up = raw.toUpperCase();
              const mapped =
                (up.includes('INT') || up.includes('NUMERIC') || up.includes('DECIMAL') ||
                 up.includes('FLOAT') || up.includes('DOUBLE') || up.includes('REAL') || up.includes('MONEY'))
                  ? 'number'
                : (up.includes('DATE') || up.includes('TIMESTAMP') || up.includes('TIME'))
                  ? 'date'
                : 'text';
              return { name: col.name, type: mapped };
            }),
            recordCount: table.record_count || table.row_count || 0,
            selectedColumns: tableSelections[table.name] || new Set(),
            tableDisabled: false,
            noFkLink: reachableFromSelected !== null && !reachableFromSelected.has(table.name),
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
          position: nodePositions?.[`table-${index}`] ?? { x: 100 + index * 430, y: 100 },
          data: {
            label: table.name,
            columns: table.columns.map((col: any) => ({
              name: col.name,
              type: col.type || 'text'
            })),
            recordCount: table.record_count || 0,
            selectedColumns: tableSelections[table.name] || new Set(),
            tableDisabled: false,
            noFkLink: reachableFromSelected !== null && !reachableFromSelected.has(table.name),
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
          tableDisabled: false,
          onViewData: (tableName: string, columns: string[]) => {
            onViewTableData(tableName, columns);
          },
          onToggleColumn: handleToggleColumnInDiagram
        }
      });
    }

    return tables;
  }, [data, onTableSelect, onViewTableData, handleToggleColumnInDiagram, tableSelections, nodePositions, reachableFromSelected]);

  const initialEdges: Edge[] = useMemo(() => {
    if (data.metadata && data.metadata.relationships && data.metadata.relationships.length > 0) {
      return data.metadata.relationships.map((rel: any, index: number) => {
        const sourceIndex = data.metadata?.tables.findIndex((t: any) => t.name === rel.source_table);
        const targetIndex = data.metadata?.tables.findIndex((t: any) => t.name === rel.target_table);
        
        if (sourceIndex >= 0 && targetIndex >= 0) {
          const isFk = rel.type === 'fk' || !rel.type;
          return {
            id: `rel-${index}`,
            source: `table-${sourceIndex}`,
            target: `table-${targetIndex}`,
            type: 'smoothstep',
            label: `${rel.source_column} → ${rel.target_column}`,
            style: isFk
              ? { stroke: '#f97316', strokeWidth: 2 }
              : { stroke: '#14b8a6', strokeWidth: 2, strokeDasharray: '6 3' },
            animated: isFk,
            markerEnd: isFk
              ? { type: MarkerType.ArrowClosed, color: '#f97316' }
              : { type: MarkerType.Arrow, color: '#14b8a6' },
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

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      if (onNodePositionsChange) {
        setNodes(nds => {
          const positions: Record<string, { x: number; y: number }> = {};
          nds.forEach(n => {
            positions[n.id] = { x: n.position.x, y: n.position.y };
          });
          onNodePositionsChange(positions);
          return nds;
        });
      }
    },
    [onNodesChange, onNodePositionsChange, setNodes]
  );

  useEffect(() => {
    setNodes(nds =>
      nds.map(node => {
        if (node.type === 'table' && typeof node.data?.label === 'string') {
          const label = node.data.label;
          return {
            ...node,
            data: {
              ...node.data,
              selectedColumns: tableSelections[label] || new Set(),
              tableDisabled: false,
              noFkLink: reachableFromSelected !== null && !reachableFromSelected.has(label),
            }
          };
        }
        return node;
      })
    );
  }, [tableSelections, reachableFromSelected, setNodes]);

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
    if (!dominantTable) return;
    const cols = Array.from(tableSelections[dominantTable] ?? []);
    if (cols.length === 0) return;
    setIsGenerating(true);
    onGenerateChart(cols, undefined, dominantTable, {
      groupBy: groupByCols.filter(Boolean),
      aggField,
      aggFunc,
      filters: filterRows.filter((f) => f.field && f.value !== ''),
      tables: [...allSelectedTables, ...joinPathResult.intermediates],
      granularity,
    });
  }, [dominantTable, tableSelections, groupByCols, aggField, aggFunc, filterRows, allSelectedTables, joinPathResult, granularity, onGenerateChart]);

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
          {totalSelectedColumns > 0 && (
            <Badge className="bg-success/20 text-success border-success/30">
              {totalSelectedColumns} {totalSelectedColumns === 1 ? 'coluna selecionada' : 'colunas selecionadas'}
            </Badge>
          )}
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
                  onNodesChange={handleNodesChange}
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
                  <div className="absolute bottom-16 left-3 z-10 bg-card border border-border rounded-lg px-3 py-2 shadow-md text-xs space-y-1.5">
                    <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Legenda</p>
                    <div className="flex items-center gap-2">
                      <svg width="32" height="10">
                        <line x1="0" y1="5" x2="28" y2="5" stroke="#f97316" strokeWidth="2" markerEnd="url(#arr-fk)" />
                        <defs>
                          <marker id="arr-fk" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                            <path d="M0,0 L0,6 L6,3 z" fill="#f97316" />
                          </marker>
                        </defs>
                      </svg>
                      <span className="text-foreground">Chave Estrangeira (FK)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg width="32" height="10">
                        <line x1="0" y1="5" x2="28" y2="5" stroke="#14b8a6" strokeWidth="2" strokeDasharray="5 3" markerEnd="url(#arr-idx)" />
                        <defs>
                          <marker id="arr-idx" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                            <path d="M0,0 L0,6 L6,3 z" fill="#14b8a6" />
                          </marker>
                        </defs>
                      </svg>
                      <span className="text-foreground">Índice</span>
                    </div>
                  </div>
                </ReactFlow>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Query Preview Panel ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base flex-wrap">
              <Code2 className="h-4 w-4" />
              Preview da Consulta
              {allSelectedTables.map((t) => (
                <Badge
                  key={t}
                  variant={t === dominantTable ? 'default' : 'outline'}
                  className="font-mono text-xs"
                >
                  {t}
                </Badge>
              ))}
              {allSelectedTables.length > 1 && (
                <Badge variant="secondary" className="text-xs">JOIN</Badge>
              )}
              {!dominantTable && (
                <span className="text-sm font-normal text-muted-foreground">
                  — selecione colunas no diagrama para começar
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* ── Left: Builder ── */}
              <div className="space-y-5">

                {/* GROUP BY */}
                <div className="space-y-2">
                  {/* GRANULARITY — shown only when a date col is in groupBy */}
                  {groupByCols.some((c) => isDateCol(c)) && (
                    <div className="pb-1 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Granularidade de Data
                      </Label>
                      <Select value={granularity} onValueChange={(v) => setGranularity(v as typeof granularity)}>
                        <SelectTrigger className="h-8 text-xs w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none"  className="text-xs">Sem agrupamento</SelectItem>
                          <SelectItem value="day"   className="text-xs">Por Dia</SelectItem>
                          <SelectItem value="week"  className="text-xs">Por Semana</SelectItem>
                          <SelectItem value="month" className="text-xs">Por Mês</SelectItem>
                          <SelectItem value="year"  className="text-xs">Por Ano</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Agrupar Por (GROUP BY)
                  </Label>
                  <div className="space-y-2">
                    {groupByCols.map((col, idx) => (
                      <div key={`gb-${col}-${idx}`} className="flex items-center gap-2">
                        <Select
                          value={col}
                          onValueChange={(v) => {
                            const updated = [...groupByCols];
                            updated[idx] = v;
                            setGroupByCols(updated);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allSelectedCols.map((c) => (
                              <SelectItem key={`${c.table}.${c.name}`} value={c.name} className="text-xs font-mono">
                                {c.name}
                                {c.table !== dominantTable && (
                                  <span className="ml-2 text-muted-foreground/60">{c.table}</span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm" variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => setGroupByCols(groupByCols.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm" variant="outline" className="h-8 text-xs"
                      disabled={allSelectedCols.length === 0}
                      onClick={() =>
                        setGroupByCols([...groupByCols, allSelectedCols[0]?.name ?? ''])
                      }
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Adicionar coluna
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* AGGREGATION */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Agregação
                  </Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={aggFunc} onValueChange={setAggFunc}>
                      <SelectTrigger className="h-8 text-xs w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="count" className="text-xs">COUNT(*)</SelectItem>
                        <SelectItem value="sum"   className="text-xs">SUM</SelectItem>
                        <SelectItem value="avg"   className="text-xs">AVG</SelectItem>
                        <SelectItem value="min"   className="text-xs">MIN</SelectItem>
                        <SelectItem value="max"   className="text-xs">MAX</SelectItem>
                      </SelectContent>
                    </Select>
                    {aggFunc !== 'count' && (
                      <>
                        <span className="text-xs text-muted-foreground">de</span>
                        <Select value={aggField} onValueChange={setAggField}>
                          <SelectTrigger className="h-8 text-xs flex-1 min-w-[120px]">
                            <SelectValue placeholder="coluna numérica" />
                          </SelectTrigger>
                          <SelectContent>
                            {allSelectedCols.map((c) => (
                              <SelectItem key={`${c.table}.${c.name}`} value={c.name} className="text-xs font-mono">
                                {c.name}
                                {c.table !== dominantTable && (
                                  <span className="ml-2 text-muted-foreground/60">{c.table}</span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>
                </div>

                <Separator />

                {/* WHERE conditions */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Condições (WHERE)
                  </Label>
                  <div className="space-y-2">
                    {filterRows.map((fr) => (
                      <div key={fr.id} className="flex items-center gap-1.5">
                        <Select
                          value={fr.field}
                          onValueChange={(v) => updateFilterField(fr.id, v)}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1 min-w-[90px]">
                            <SelectValue placeholder="campo" />
                          </SelectTrigger>
                          <SelectContent>
                            {allSelectedCols.map((c) => (
                              <SelectItem key={`${c.table}.${c.name}`} value={c.name} className="text-xs font-mono">
                                {c.name}
                                {c.table !== dominantTable && (
                                  <span className="ml-2 text-muted-foreground/60">{c.table}</span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={fr.op}
                          onValueChange={(v) => updateFilterOp(fr.id, v)}
                        >
                          <SelectTrigger className="h-8 text-xs w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="eq"   className="text-xs">=</SelectItem>
                            <SelectItem value="gt"   className="text-xs">&gt;</SelectItem>
                            <SelectItem value="lt"   className="text-xs">&lt;</SelectItem>
                            <SelectItem value="gte"  className="text-xs">&gt;=</SelectItem>
                            <SelectItem value="lte"  className="text-xs">&lt;=</SelectItem>
                            <SelectItem value="like" className="text-xs">LIKE</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          className="h-8 text-xs flex-1 min-w-[80px]"
                          placeholder="valor"
                          value={fr.value}
                          type={(() => {
                            const colType = allSelectedCols.find((c) => c.name === fr.field)?.type.toUpperCase() ?? '';
                            if (colType.includes('DATE') || colType.includes('TIMESTAMP')) return 'date';
                            if (
                              colType.includes('INT') || colType.includes('NUMERIC') ||
                              colType.includes('DECIMAL') || colType.includes('FLOAT') ||
                              colType.includes('DOUBLE') || colType.includes('REAL') || colType.includes('MONEY')
                            ) return 'number';
                            return 'text';
                          })()}
                          onChange={(e) => updateFilterValue(fr.id, e.target.value)}
                        />
                        <Button
                          size="sm" variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeFilter(fr.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm" variant="outline" className="h-8 text-xs"
                      disabled={allSelectedCols.length === 0}
                      onClick={() => {
                        setFilterRows((rows) => [
                          ...rows,
                          { id: nextFilterId, field: allSelectedCols[0]?.name ?? '', op: 'eq', value: '' },
                        ]);
                        setNextFilterId((n) => n + 1);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Adicionar condição
                    </Button>
                  </div>
                </div>
              </div>

              {/* ── Right: SQL preview + action ── */}
              <div className="flex flex-col gap-3">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  SQL Gerado
                </Label>
                <pre className="flex-1 min-h-[200px] overflow-auto rounded-lg border border-border bg-muted/40 p-4 text-xs font-mono leading-relaxed text-foreground whitespace-pre">
                  {sqlPreview}
                </pre>
                <Button
                  className="w-full"
                  onClick={handleConfirmSelection}
                  disabled={!dominantTable || isGenerating}
                >
                  {isGenerating
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Play className="h-4 w-4 mr-2" />}
                  {isGenerating ? 'Gerando...' : 'Gerar Gráfico'}
                </Button>
              </div>

            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
