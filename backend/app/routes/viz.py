from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime
import time
import pandas as pd

# Importar módulos do backend
from app.data.query_model import QueryModel
from app.data.sql_generator import SQLGenerator
from app.data.pandas_executor import PandasExecutor
from app.data.loader import DataLoader
from app.data.metadata import extract_metadata
from app.data.connectors import ConnectorFactory, DatabaseConnector
from app.services.recommender import recommend_chart_top_k
from app.data.chart_query_builder import (
    ChartQueryBuilder,
    _build_filter_clauses,
    add_pareto_cumulative,
    normalize_chart_type,
)

router = APIRouter()

# ============ Pydantic Models para Request/Response ============

class DatabaseConnectionRequest(BaseModel):
    db_type: str  # postgresql, mysql, sqlserver, sqlite, oracle
    host: Optional[str] = None
    port: Optional[str] = None
    database: str
    user: Optional[str] = None
    password: Optional[str] = None

class AggregationRequest(BaseModel):
    field: str
    func: str  # sum, avg, count, min, max
    alias: Optional[str] = None

class FilterRequest(BaseModel):
    field: str
    operator: str  # eq, gt, lt, gte, lte, in, like
    value: Any

class QueryModelRequest(BaseModel):
    source_type: str  # database | file
    tables: List[str]
    base_table: str
    group_by: List[str] = []
    aggregations: List[AggregationRequest] = []
    filters: Optional[List[FilterRequest]] = None
    chart_type: Optional[str] = None   # drives SQL/Pandas shape; inferred by ML if omitted
    z_column: Optional[str] = None    # third column for heatmap / pivot table

class QueryExecutionResponse(BaseModel):
    data: List[dict]
    columns: List[str]
    row_count: int

class ChartAlternative(BaseModel):
    chart_type: str
    probability: float

class ChartRecommendationResponse(BaseModel):
    chart_type: str
    title: str
    reason: str
    x_field: str
    y_field: str
    alternatives: Optional[List[ChartAlternative]] = None
    configuration: Optional[dict] = None

class ExecutionResponse(BaseModel):
    query_model: dict
    result: QueryExecutionResponse
    recommendation: ChartRecommendationResponse
    execution_time_ms: float

# ============ Endpoints de Gerenciamento de Conexões ============

# Armazenar conexão ativa
_active_connector: Optional[DatabaseConnector] = None

@router.get("/databases/supported")
async def get_supported_databases():
    """Retornar lista de bancos de dados suportados"""
    return {
        "supported": [
            {
                "type": "postgresql",
                "name": "PostgreSQL",
                "default_port": "5432",
                "description": "Banco relacional open-source"
            },
            {
                "type": "mysql",
                "name": "MySQL",
                "default_port": "3306",
                "description": "Banco relacional popular"
            },
            {
                "type": "sqlserver",
                "name": "SQL Server",
                "default_port": "1433",
                "description": "Banco relacional da Microsoft"
            },
            {
                "type": "sqlite",
                "name": "SQLite",
                "default_port": None,
                "description": "Banco de arquivo embutido"
            },
            {
                "type": "oracle",
                "name": "Oracle Database",
                "default_port": "1521",
                "description": "Banco relacional empresarial"
            }
        ]
    }

@router.post("/databases/connect")
async def connect_database(request: DatabaseConnectionRequest):
    """Estabelecer conexão com um banco de dados"""
    global _active_connector
    
    print(f"[DEBUG] Conectando com: {request.db_type}, database={request.database}")
    
    try:
        # Preparar parâmetros de conexão
        params = {
            "database": request.database,
        }
        
        if request.host:
            params["host"] = request.host
        if request.port:
            params["port"] = request.port
        if request.user:
            params["user"] = request.user
        if request.password:
            params["password"] = request.password
        
        print(f"[DEBUG] Parâmetros de conexão: {params}")
        
        # Criar conector
        connector = ConnectorFactory.create(request.db_type, params)
        print(f"[DEBUG] Conector criado: {type(connector).__name__}")
        
        # Testar conexão
        if not connector.test_connection():
            print("[ERROR] Falha ao testar conexão")
            raise HTTPException(
                status_code=400,
                detail="Falha ao conectar com o banco de dados"
            )
        
        # Salvar como conexão ativa
        _active_connector = connector
        print(f"[DEBUG] Conector salvo como ativo: {_active_connector is not None}")
        
        return {
            "success": True,
            "message": "Conectado com sucesso",
            "db_type": request.db_type,
            "database": request.database
        }
        
    except Exception as e:
        print(f"[ERROR] Erro ao conectar: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=400,
            detail=f"Erro ao conectar: {str(e)}"
        )

@router.get("/databases/tables")
async def get_connected_tables():
    """Obter tabelas do banco conectado"""
    global _active_connector
    
    if not _active_connector:
        raise HTTPException(
            status_code=400,
            detail="Nenhum banco de dados conectado"
        )
    
    try:
        tables = _active_connector.get_tables()
        
        # Obter metadados das tabelas
        table_metadata = []
        for table_name in tables:
            columns = _active_connector.get_table_columns(table_name)
            
            # Obter contagem de registros
            try:
                count_query = f"SELECT COUNT(*) FROM {table_name}"
                count_result = _active_connector.execute_query(count_query)
                record_count = int(count_result.iloc[0, 0]) if len(count_result) > 0 else 0
            except Exception as e:
                print(f"[WARN] Erro ao contar registros de {table_name}: {e}")
                record_count = 0
            
            table_metadata.append({
                "name": table_name,
                "columns": columns,
                "row_count": record_count,
                "record_count": record_count
            })

        # Collect primary keys for index relationship detection
        primary_keys = {}
        for tname in tables:
            primary_keys[tname] = _active_connector.get_primary_key_columns(tname)

        # Build relationships (FK + index-based)
        relationships = []
        fk_pairs = set()

        for tname in tables:
            try:
                fks = _active_connector.get_foreign_keys(tname)
                for fk in fks:
                    if fk.get('constrained_columns') and fk.get('referred_columns'):
                        relationships.append({
                            'source_table': tname,
                            'source_column': fk['constrained_columns'][0],
                            'target_table': fk['referred_table'],
                            'target_column': fk['referred_columns'][0],
                            'type': 'fk'
                        })
                        fk_pairs.add((tname, fk['referred_table']))
                        fk_pairs.add((fk['referred_table'], tname))
            except Exception as e:
                print(f"[WARN] FK para {tname}: {e}")

        for tname in tables:
            try:
                indexes = _active_connector.get_indexes(tname)
                for idx in indexes:
                    for col in idx.get('column_names', []):
                        for other in tables:
                            if other == tname:
                                continue
                            if col in primary_keys.get(other, []) and (tname, other) not in fk_pairs:
                                relationships.append({
                                    'source_table': tname,
                                    'source_column': col,
                                    'target_table': other,
                                    'target_column': col,
                                    'type': 'index'
                                })
                                fk_pairs.add((tname, other))
            except Exception as e:
                print(f"[WARN] Indexes para {tname}: {e}")

        print(f"[DEBUG] Retornando {len(table_metadata)} tabelas e {len(relationships)} relacionamentos")

        return {
            "tables": table_metadata,
            "relationships": relationships
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao obter tabelas: {str(e)}"
        )

@router.get("/databases/table/{table_name}/data")
async def get_connected_table_data(table_name: str, limit: int = 100, offset: int = 0):
    """Obter dados de uma tabela do banco conectado"""
    global _active_connector
    
    print(f"[DEBUG] Recebido request para tabela: {table_name}")
    print(f"[DEBUG] _active_connector disponível: {_active_connector is not None}")
    
    if not _active_connector:
        print("[ERROR] Nenhum conector ativo disponível")
        raise HTTPException(
            status_code=400,
            detail="Nenhum banco de dados conectado"
        )
    
    try:
        print(f"[DEBUG] Buscando dados da tabela: {table_name} (limit={limit}, offset={offset})")
        data = _active_connector.get_table_data(table_name, limit, offset)
        print(f"[DEBUG] Retornados {len(data.get('data', []))} registros")
        data["success"] = True
        return data
    except Exception as e:
        print(f"[ERROR] Erro ao obter dados: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao obter dados: {str(e)}"
        )

# ============ Endpoints de Execução ============


def _qualify_filter_field(
    clause: str,
    connector: DatabaseConnector,
    all_tables: List[str],
    prefer_table: str,
) -> str:
    """
    Given a SQL WHERE clause fragment like "field = 'value'" or "field > 5",
    prefix the field name with its owning table if it is unqualified.
    """
    import re
    # Match a leading identifier (no dot) followed by a space and SQL operator
    m = re.match(r'^([A-Za-z_]\w*)(\s+(?:=|>|<|>=|<=|LIKE|IN)\b.*)', clause, re.IGNORECASE)
    if not m:
        return clause
    field, rest = m.group(1), m.group(2)
    qualified = _qualify_column(connector, all_tables, field, prefer_table)
    return f"{qualified}{rest}"


def _qualify_column(
    connector: DatabaseConnector,
    all_tables: List[str],
    col_name: str,
    prefer_table: str = "",
) -> str:
    """
    Return 'table.col' for col_name by inspecting which tables in all_tables contain it.
    If already qualified (contains '.') or empty, returns as-is.
    When multiple tables own the column, prefer_table wins; otherwise first owner is used.
    """
    if not col_name or '.' in col_name:
        return col_name
    owners: List[str] = []
    for table in all_tables:
        try:
            cols = [c["name"] for c in connector.get_table_columns(table)]
            if col_name in cols:
                owners.append(table)
        except Exception:
            pass
    if not owners:
        return col_name  # not found — return unqualified and let DB report the error
    if prefer_table and prefer_table in owners:
        return f"{prefer_table}.{col_name}"
    return f"{owners[0]}.{col_name}"


def _build_multi_group_sql(
    builder: "ChartQueryBuilder",
    chart_type: str,
    base_table: str,
    group_by_cols: List[str],
    y_col: str,
    agg_func: str,
    z_col: Optional[str],
    filters: List[str],
    joins: str,
) -> str:
    """
    Build a SQL query that supports multiple GROUP BY columns.

    When there is exactly one group-by column, delegates to ChartQueryBuilder.build_sql
    so chart-type-specific logic (ordering, limits) is preserved.
    When there are multiple columns, generates a generic SELECT with all group-by cols
    plus the aggregation, GROUP BY all cols, ORDER BY value DESC, LIMIT 30.
    """
    from app.data.chart_query_builder import _safe_ident, _agg_expr, _where

    x_col = group_by_cols[0] if group_by_cols else ""

    if len(group_by_cols) <= 1:
        return builder.build_sql(
            chart_type=chart_type,
            base_table=base_table,
            x_col=x_col,
            y_col=y_col,
            agg_func=agg_func,
            z_col=z_col,
            filters=filters,
            joins=joins,
        )

    # Multi-column GROUP BY — build a generic query
    safe_gb = [_safe_ident(c) for c in group_by_cols]
    agg = _agg_expr(agg_func, y_col) if y_col else "COUNT(*)"
    where = _where(filters)
    joins_str = f" {joins}" if joins else ""
    gb_clause = ", ".join(safe_gb)
    select_cols = ", ".join(safe_gb)
    return (
        f"SELECT {select_cols}, {agg} AS valor "
        f"FROM {_safe_ident(base_table)}{joins_str}{where} "
        f"GROUP BY {gb_clause} "
        f"ORDER BY valor DESC"
    )


def _bfs_path_to_target(
    adj: dict,
    start_nodes: set,
    target: str,
) -> Optional[List[tuple]]:
    """
    BFS from any already-joined node to `target` through the full FK graph.
    Returns list of (from_table, to_table, from_col, to_col) steps, or None.
    """
    from collections import deque
    visited = set(start_nodes)
    queue = deque([(node, []) for node in start_nodes])
    while queue:
        current, path = queue.popleft()
        for neighbor, from_col, to_col in adj.get(current, []):
            if neighbor not in visited:
                new_path = path + [(current, neighbor, from_col, to_col)]
                if neighbor == target:
                    return new_path
                visited.add(neighbor)
                queue.append((neighbor, new_path))
    return None


def _build_join_clauses(connector: DatabaseConnector, base_table: str, extra_tables: List[str]) -> str:
    """
    Transitive BFS over the COMPLETE FK graph (all DB tables) to build JOIN clauses
    that connect every table in extra_tables to base_table.
    Automatically includes intermediate bridge tables.
    """
    # Build full adjacency from ALL tables in the DB
    try:
        all_db_tables = connector.get_tables()
    except Exception:
        all_db_tables = [base_table] + extra_tables
    adj: dict = {}
    for table in all_db_tables:
        for fk in (connector.get_foreign_keys(table) or []):
            referred = fk.get("referred_table", "")
            local_cols = fk.get("constrained_columns", [])
            ref_cols = fk.get("referred_columns", [])
            if referred and local_cols and ref_cols:
                adj.setdefault(table, []).append((referred, local_cols[0], ref_cols[0]))
                adj.setdefault(referred, []).append((table, ref_cols[0], local_cols[0]))
    # BFS from base_table, expanding as we join new tables
    joined: set = {base_table}
    added_edges: set = set()
    clauses: List[str] = []
    for target in extra_tables:
        if target in joined:
            continue
        path = _bfs_path_to_target(adj, joined, target)
        if not path:
            continue
        for (from_t, to_t, from_col, to_col) in path:
            edge_key = tuple(sorted([from_t, to_t]))
            if edge_key not in added_edges:
                added_edges.add(edge_key)
                clauses.append(f"JOIN {to_t} ON {from_t}.{from_col} = {to_t}.{to_col}")
            joined.add(to_t)
    return " ".join(clauses)


@router.post("/execute")
async def execute_query(query_req: QueryModelRequest):
    """
    Fluxo Principal:
    QueryModel → ChartQueryBuilder (SQL/Pandas) → DataFrame → Recomendação de Gráfico

    O campo `chart_type` determina a forma dos dados retornados:
      - bar/column : GROUP BY x, AGG(y) DESC  LIMIT 30
      - line/area  : GROUP BY x, AGG(y) ASC   (série temporal ordenada)
      - scatter    : SELECT x, y raw           LIMIT 500
      - pie        : GROUP BY x, AGG(y) DESC   LIMIT 8
      - histogram  : SELECT x raw              LIMIT 2000
      - heatmap    : GROUP BY x, y, AGG(z)
      - treemap    : GROUP BY x, AGG(y) DESC   LIMIT 50
      - pareto     : GROUP BY x, AGG(y) DESC + cumulative_pct
      - kpi        : SELECT AGG(y) AS value    (escalar)
      - pivottable : GROUP BY x, y, AGG(z)
      - radar      : GROUP BY x, AGG(y)        LIMIT 8
      - map        : GROUP BY geo, AGG(y) DESC LIMIT 200
      - table      : SELECT * LIMIT 100
    """
    start_time = time.time()

    try:
        # ── Parse request fields ─────────────────────────────────────────────
        chart_type = normalize_chart_type(query_req.chart_type or "bar")
        group_by_cols = query_req.group_by  # full list — used for multi-col SQL
        x_col = group_by_cols[0] if group_by_cols else ""
        z_col = query_req.z_column

        agg_func = "sum"
        y_col = ""
        if query_req.aggregations:
            y_col = query_req.aggregations[0].field
            agg_func = query_req.aggregations[0].func or "sum"

        filter_clauses = _build_filter_clauses(query_req.filters or [])
        builder = ChartQueryBuilder()

        # ── Execute query ────────────────────────────────────────────────────
        if query_req.source_type == "database":
            joins_str = ""
            if _active_connector is not None:
                # Step 1: qualify every column against ALL tables in the DB.
                # This discovers which table each column belongs to, even when the
                # frontend only sent the base table in query_req.tables.
                try:
                    all_db_tables = _active_connector.get_tables()
                except Exception:
                    all_db_tables = list(query_req.tables)

                needed_tables: set = set(query_req.tables)  # start with explicitly requested

                def _qualify_and_track(col: str) -> str:
                    if not col or '.' in col:
                        return col
                    q = _qualify_column(_active_connector, all_db_tables, col, query_req.base_table)
                    if '.' in q:
                        needed_tables.add(q.split('.')[0])
                    return q

                group_by_cols = [_qualify_and_track(c) for c in group_by_cols]
                x_col = group_by_cols[0] if group_by_cols else x_col
                y_col = _qualify_and_track(y_col) if y_col else y_col
                if z_col:
                    z_col = _qualify_and_track(z_col)

                # Step 2: build JOINs for all discovered tables (transitive BFS)
                extra_tables = [t for t in needed_tables if t != query_req.base_table]
                if extra_tables:
                    joins_str = _build_join_clauses(_active_connector, query_req.base_table, extra_tables)
                    filter_clauses = [
                        _qualify_filter_field(
                            clause, _active_connector, list(needed_tables), query_req.base_table
                        )
                        for clause in filter_clauses
                    ]

            sql = _build_multi_group_sql(
                builder=builder,
                chart_type=chart_type,
                base_table=query_req.base_table,
                group_by_cols=group_by_cols,
                y_col=y_col,
                agg_func=agg_func,
                z_col=z_col,
                filters=filter_clauses,
                joins=joins_str,
            )
            # Use active connector if available, otherwise fall back to DataLoader
            try:
                if _active_connector is not None:
                    df = _active_connector.execute_query(sql)
                else:
                    loader = DataLoader()
                    df = loader.execute_sql(sql)
            except Exception as sql_err:
                # If the aggregation column is not numeric (e.g. text), retry with COUNT(*)
                err_str = str(sql_err).lower()
                if y_col and ("function sum" in err_str or "function avg" in err_str or
                              "operator does not exist" in err_str or "cannot be used" in err_str or
                              "does not exist" in err_str):
                    fallback_sql = _build_multi_group_sql(
                        builder=builder,
                        chart_type=chart_type,
                        base_table=query_req.base_table,
                        group_by_cols=group_by_cols,
                        y_col="",           # empty → COUNT(*)
                        agg_func="count",
                        z_col=z_col,
                        filters=filter_clauses,
                        joins=joins_str,
                    )
                    if _active_connector is not None:
                        df = _active_connector.execute_query(fallback_sql)
                    else:
                        loader = DataLoader()
                        df = loader.execute_sql(fallback_sql)
                else:
                    raise
        else:
            # File source (CSV / XLS)
            loader = DataLoader()
            dataframes = loader.load_data()
            if not dataframes:
                raise ValueError("Nenhum arquivo CSV/XLS encontrado")
            table_name = query_req.tables[0] if query_req.tables else ""
            raw_df = (
                dataframes[table_name]
                if table_name in dataframes
                else next(iter(dataframes.values()))
            )
            df = builder.build_pandas(
                chart_type=chart_type,
                df=raw_df,
                x_col=x_col,
                y_col=y_col,
                agg_func=agg_func,
                z_col=z_col,
            )

        # ── Post-processing ──────────────────────────────────────────────────
        # Pareto: add cumulative percentage column when result came from SQL
        if chart_type == "pareto" and query_req.source_type == "database":
            df = add_pareto_cumulative(df)

        # ── Build response ───────────────────────────────────────────────────
        result_data = df.to_dict("records")
        columns = list(df.columns)
        row_count = len(df)

        chart_recommendation = _recommend_chart_enhanced(
            df,
            columns,
            query_req.group_by,
            query_req.aggregations,
        )

        execution_time = (time.time() - start_time) * 1000

        return ExecutionResponse(
            query_model=query_req.dict(),
            result=QueryExecutionResponse(
                data=result_data,
                columns=columns,
                row_count=row_count,
            ),
            recommendation=chart_recommendation,
            execution_time_ms=execution_time,
        ).dict()

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/recommend")
async def recommend_visualization(query_result: dict):
    """
    Recomenda um tipo de gráfico baseado nos dados
    """
    try:
        data = query_result.get('data', [])
        columns = query_result.get('columns', [])
        query_model = query_result.get('query_model', {})

        if not data or not columns:
            raise ValueError("Dados ou colunas vazias")

        df = pd.DataFrame(data)
        
        recommendation = _recommend_chart_enhanced(
            df,
            columns,
            query_model.get('group_by', []),
            query_model.get('aggregations', [])
        )

        return recommendation.dict()

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/validate")
async def validate_query(query_req: QueryModelRequest):
    """
    Valida uma query antes de executar
    """
    errors = []

    if not query_req.base_table:
        errors.append("base_table é obrigatório")
    
    if not query_req.tables:
        errors.append("tables não pode estar vazio")

    if len(errors) > 0:
        return {"valid": False, "errors": errors}

    return {"valid": True}


@router.get("/tables")
async def get_table_metadata():
    """
    Retorna metadados das tabelas disponíveis
    """
    try:
        loader = DataLoader()
        metadata = loader.get_tables_metadata()
        return metadata
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/tables/list")
async def list_tables():
    """
    Retorna lista de nomes das tabelas disponíveis no banco
    """
    try:
        from sqlalchemy import create_engine, inspect
        from app.config.settings import DB_URL
        
        engine = create_engine(DB_URL)
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        return {
            "success": True,
            "tables": tables,
            "count": len(tables)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar tabelas: {str(e)}")


class CustomDatabaseConnection(BaseModel):
    host: str
    port: int = 5432
    database: str
    username: str
    password: str


@router.post("/test-connection")
async def test_custom_connection(conn: CustomDatabaseConnection):
    """
    Testa conexão com banco de dados customizado
    Retorna metadados das tabelas e relacionamentos se a conexão for bem-sucedida
    """
    try:
        from sqlalchemy import create_engine, inspect
        
        print(f"DEBUG: Received connection request - host={conn.host}, port={conn.port}, database={conn.database}, user={conn.username}")
        
        # Construir URL de conexão
        db_url = f"postgresql://{conn.username}:{conn.password}@{conn.host}:{conn.port}/{conn.database}"
        print(f"DEBUG: Connection URL constructed (password hidden)")
        
        # Testar conexão
        engine = create_engine(db_url)
        with engine.connect() as connection:
            inspector = inspect(engine)
            tables = inspector.get_table_names()
        
        # Se chegou aqui, conexão foi bem-sucedida
        metadata = {
            'tables': [],
            'relationships': []
        }
        
        inspector = inspect(engine)
        
        # Coletar informações de tabelas
        for table_name in tables:
            columns = inspector.get_columns(table_name)
            
            # Contar registros na tabela
            try:
                with engine.connect() as connection:
                    from sqlalchemy import text
                    result = connection.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                    row_count = result.scalar() or 0
            except Exception as e:
                print(f"DEBUG: Could not count rows for table {table_name}: {e}")
                row_count = 0
            
            metadata['tables'].append({
                'name': table_name,
                'columns': [
                    {
                        'name': col['name'],
                        'type': str(col['type'])
                    }
                    for col in columns
                ],
                'row_count': row_count
            })
        
        # Coletar informações de chaves estrangeiras (relacionamentos)
        for table_name in tables:
            try:
                foreign_keys = inspector.get_foreign_keys(table_name)
                for fk in foreign_keys:
                    metadata['relationships'].append({
                        'source_table': table_name,
                        'source_column': fk['constrained_columns'][0] if fk['constrained_columns'] else None,
                        'target_table': fk['referred_table'],
                        'target_column': fk['referred_columns'][0] if fk['referred_columns'] else None,
                        'type': 'fk'
                    })
            except Exception as e:
                print(f"DEBUG: Could not get foreign keys for table {table_name}: {e}")
        
        return {
            "success": True,
            "message": f"Conexão bem-sucedida! {len(tables)} tabelas encontradas.",
            "metadata": metadata
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro na conexão: {str(e)}")


@router.get("/tables/{table_name}/data")
async def get_table_data(table_name: str, limit: int = 100, offset: int = 0):
    """
    Retorna dados de uma tabela específica do banco de dados
    """
    try:
        from sqlalchemy import text, create_engine, inspect
        from app.config.settings import settings
        
        print(f"[DEBUG] Buscando dados da tabela: {table_name}")
        print(f"[DEBUG] DB_URL: {settings.DB_URL}")
        
        # Criar engine com pool_pre_ping para verificar conexão
        engine = create_engine(settings.DB_URL, pool_pre_ping=True)
        
        # Verificar se a tabela existe
        with engine.connect() as connection:
            inspector = inspect(engine)
            available_tables = inspector.get_table_names()
            
            print(f"[DEBUG] Tabelas disponíveis: {available_tables}")
            
            if table_name not in available_tables:
                raise HTTPException(
                    status_code=404, 
                    detail=f"Tabela '{table_name}' não encontrada. Tabelas disponíveis: {available_tables}"
                )
            
            # Buscar dados da tabela
            query = f"SELECT * FROM {table_name} LIMIT {limit} OFFSET {offset}"
            print(f"[DEBUG] Executando query: {query}")
            
            result = connection.execute(text(query))
            rows = result.fetchall()
            columns = [col for col in result.keys()]
            
            print(f"[DEBUG] Encontrados {len(rows)} linhas e {len(columns)} colunas")
            
            # Contar total de registros
            count_query = f"SELECT COUNT(*) FROM {table_name}"
            count_result = connection.execute(text(count_query))
            total_count = count_result.scalar() or 0
        
        # Converter resultados para lista de dicts
        data = []
        for row in rows:
            data.append(dict(zip(columns, row)))
        
        print(f"[DEBUG] Retornando sucesso para {table_name}")
        
        return {
            "success": True,
            "data": data,
            "columns": list(columns),
            "total_count": total_count,
            "limit": limit,
            "offset": offset
        }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"[ERROR] {error_detail}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar dados: {error_detail}")


# ============ Funções Auxiliares ============

def _build_metadata_for_model(df: pd.DataFrame, columns: List[str]) -> dict:
    """Extrai features numéricas do DataFrame para alimentar o modelo ML."""
    import numpy as np

    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
    categorical_cols = [c for c in columns if c not in numeric_cols]

    # Detectar colunas temporais por nome ou tipo
    temporal_keywords = ["date", "time", "year", "month", "day", "hora", "data"]
    temporal_cols = [
        c for c in columns
        if any(kw in c.lower() for kw in temporal_keywords)
        or pd.api.types.is_datetime64_any_dtype(df[c])
    ]

    # Cardinalidade média das colunas categóricas
    avg_cardinality = float(
        np.mean([df[c].nunique() for c in categorical_cols]) if categorical_cols else 0
    )

    # Correlação máxima entre pares numéricos
    corr_strength = 0.0
    if len(numeric_cols) >= 2:
        corr_matrix = df[numeric_cols].corr().abs()
        np.fill_diagonal(corr_matrix.values, 0)
        corr_strength = float(corr_matrix.max().max())

    pct_nulls = float(df.isnull().mean().mean())

    numeric_cardinality_mean = float(
        np.mean([df[c].nunique() for c in numeric_cols]) if numeric_cols else 0
    )

    total = len(columns) or 1
    return {
        "num_cols": len(numeric_cols),
        "cat_cols": len(categorical_cols),
        "temporal_cols": len(temporal_cols),
        "avg_cardinality": avg_cardinality,
        "corr_strength": corr_strength,
        "pct_nulls": pct_nulls,
        "numeric_cardinality_mean": numeric_cardinality_mean,
        "contains_geo": 0,
        "hierarchical_cat": 0,
        "numeric_ratio": len(numeric_cols) / total,
    }


def _recommend_chart_enhanced(
    df: pd.DataFrame,
    columns: List[str],
    group_by: List[str],
    aggregations: List[AggregationRequest]
) -> ChartRecommendationResponse:
    """
    Recomenda um gráfico usando o modelo ML (com fallback para regras).
    """

    # Determinar campos X e Y
    x_field = group_by[0] if group_by else columns[0]

    if aggregations:
        y_field = aggregations[0].field if hasattr(aggregations[0], "field") else aggregations[0].get("field", columns[-1])
    elif len(columns) > 1:
        y_field = columns[1]
    else:
        y_field = columns[0]

    # Construir metadata para o modelo
    metadata = _build_metadata_for_model(df, columns)

    # Chamar modelo ML (top-3 recomendações)
    top3 = recommend_chart_top_k(metadata, k=3)
    chart_type = top3[0]["chart_type"]
    probability = top3[0]["probability"]

    # Gerar razão baseada na fonte da recomendação
    reason = f"Modelo ML (confiança {probability:.0%})" if probability < 1.0 else "Recomendação por regras"

    alternatives = [
        ChartAlternative(chart_type=r["chart_type"], probability=r["probability"])
        for r in top3
    ]

    return ChartRecommendationResponse(
        chart_type=chart_type,
        title=f"{y_field} por {x_field}",
        reason=reason,
        x_field=x_field,
        y_field=y_field,
        alternatives=alternatives,
        configuration={
            "responsive": True,
            "animation": True,
            "theme": "light"
        }
    )

