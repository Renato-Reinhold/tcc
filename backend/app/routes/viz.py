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
        
        print(f"[DEBUG] Retornando {len(table_metadata)} tabelas")
        
        return {
            "tables": table_metadata
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
        x_col = query_req.group_by[0] if query_req.group_by else ""
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
            sql = builder.build_sql(
                chart_type=chart_type,
                base_table=query_req.base_table,
                x_col=x_col,
                y_col=y_col,
                agg_func=agg_func,
                z_col=z_col,
                filters=filter_clauses,
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
                              "operator does not exist" in err_str or "cannot be used" in err_str):
                    fallback_sql = builder.build_sql(
                        chart_type=chart_type,
                        base_table=query_req.base_table,
                        x_col=x_col,
                        y_col="",           # empty → COUNT(*)
                        agg_func="count",
                        z_col=z_col,
                        filters=filter_clauses,
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
                        'target_column': fk['referred_columns'][0] if fk['referred_columns'] else None
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

