"""
Conectores para diferentes bancos de dados
Suporta: PostgreSQL, MySQL, SQL Server, SQLite, Oracle
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import pandas as pd
from sqlalchemy import create_engine, inspect, text

class DatabaseConnector(ABC):
    """Classe abstrata para conectores de banco de dados"""
    
    def __init__(self, connection_params: Dict[str, Any]):
        self.connection_params = connection_params
        self.engine = None
        self._connect()
    
    @abstractmethod
    def _connect(self):
        """Estabelecer conexão com o banco"""
        pass
    
    @abstractmethod
    def get_connection_url(self) -> str:
        """Retornar URL de conexão"""
        pass
    
    def test_connection(self) -> bool:
        """Testar conexão com o banco"""
        try:
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except Exception as e:
            print(f"Erro ao testar conexão: {e}")
            return False
    
    def execute_query(self, sql: str) -> pd.DataFrame:
        """Executar query e retornar DataFrame"""
        try:
            return pd.read_sql(text(sql), self.engine)
        except Exception as e:
            print(f"Erro ao executar query: {e}")
            raise
    
    def get_tables(self) -> List[str]:
        """Obter lista de tabelas"""
        try:
            inspector = inspect(self.engine)
            return inspector.get_table_names()
        except Exception as e:
            print(f"Erro ao obter tabelas: {e}")
            return []
    
    def get_table_columns(self, table_name: str) -> List[Dict[str, str]]:
        """Obter colunas de uma tabela"""
        try:
            inspector = inspect(self.engine)
            columns = inspector.get_columns(table_name)
            return [
                {
                    "name": col["name"],
                    "type": str(col["type"])
                }
                for col in columns
            ]
        except Exception as e:
            print(f"Erro ao obter colunas: {e}")
            return []
    
    def get_table_data(self, table_name: str, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        """Obter dados de uma tabela"""
        try:
            query = f"SELECT * FROM {table_name} LIMIT {limit} OFFSET {offset}"
            df = pd.read_sql(text(query), self.engine)
            
            count_query = f"SELECT COUNT(*) FROM {table_name}"
            count_result = pd.read_sql(text(count_query), self.engine)
            total_count = int(count_result.iloc[0, 0])
            
            return {
                "data": df.to_dict(orient='records'),
                "columns": df.columns.tolist(),
                "total_count": total_count,
                "limit": limit,
                "offset": offset
            }
        except Exception as e:
            print(f"Erro ao obter dados da tabela: {e}")
            raise


class PostgreSQLConnector(DatabaseConnector):
    """Conector para PostgreSQL"""
    
    def get_connection_url(self) -> str:
        host = self.connection_params.get('host', 'localhost')
        port = self.connection_params.get('port', '5432')
        database = self.connection_params.get('database', 'postgres')
        user = self.connection_params.get('user', 'postgres')
        password = self.connection_params.get('password', '')
        
        return f"postgresql://{user}:{password}@{host}:{port}/{database}"
    
    def _connect(self):
        try:
            self.engine = create_engine(self.get_connection_url(), pool_pre_ping=True)
        except Exception as e:
            print(f"Erro ao conectar PostgreSQL: {e}")
            raise


class MySQLConnector(DatabaseConnector):
    """Conector para MySQL"""
    
    def get_connection_url(self) -> str:
        host = self.connection_params.get('host', 'localhost')
        port = self.connection_params.get('port', '3306')
        database = self.connection_params.get('database', 'mysql')
        user = self.connection_params.get('user', 'root')
        password = self.connection_params.get('password', '')
        
        return f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"
    
    def _connect(self):
        try:
            self.engine = create_engine(self.get_connection_url(), pool_pre_ping=True)
        except Exception as e:
            print(f"Erro ao conectar MySQL: {e}")
            raise


class SQLServerConnector(DatabaseConnector):
    """Conector para SQL Server"""
    
    def get_connection_url(self) -> str:
        host = self.connection_params.get('host', 'localhost')
        port = self.connection_params.get('port', '1433')
        database = self.connection_params.get('database', 'master')
        user = self.connection_params.get('user', 'sa')
        password = self.connection_params.get('password', '')
        
        return f"mssql+pyodbc://{user}:{password}@{host}:{port}/{database}?driver=ODBC+Driver+17+for+SQL+Server"
    
    def _connect(self):
        try:
            self.engine = create_engine(self.get_connection_url(), pool_pre_ping=True)
        except Exception as e:
            print(f"Erro ao conectar SQL Server: {e}")
            raise


class SQLiteConnector(DatabaseConnector):
    """Conector para SQLite"""
    
    def get_connection_url(self) -> str:
        database = self.connection_params.get('database', 'database.db')
        return f"sqlite:///{database}"
    
    def _connect(self):
        try:
            self.engine = create_engine(self.get_connection_url())
        except Exception as e:
            print(f"Erro ao conectar SQLite: {e}")
            raise


class OracleConnector(DatabaseConnector):
    """Conector para Oracle"""
    
    def get_connection_url(self) -> str:
        host = self.connection_params.get('host', 'localhost')
        port = self.connection_params.get('port', '1521')
        database = self.connection_params.get('database', 'xe')
        user = self.connection_params.get('user', 'system')
        password = self.connection_params.get('password', '')
        
        return f"oracle+cx_Oracle://{user}:{password}@{host}:{port}/{database}"
    
    def _connect(self):
        try:
            self.engine = create_engine(self.get_connection_url(), pool_pre_ping=True)
        except Exception as e:
            print(f"Erro ao conectar Oracle: {e}")
            raise


# Factory para criar conectores
class ConnectorFactory:
    """Factory para criar conectores apropriados"""
    
    _connectors = {
        'postgresql': PostgreSQLConnector,
        'postgres': PostgreSQLConnector,
        'mysql': MySQLConnector,
        'sqlserver': SQLServerConnector,
        'mssql': SQLServerConnector,
        'sqlite': SQLiteConnector,
        'oracle': OracleConnector,
    }
    
    @classmethod
    def create(cls, db_type: str, params: Dict[str, Any]) -> DatabaseConnector:
        """Criar conector baseado no tipo de banco"""
        db_type = db_type.lower()
        
        if db_type not in cls._connectors:
            raise ValueError(f"Tipo de banco não suportado: {db_type}")
        
        connector_class = cls._connectors[db_type]
        return connector_class(params)
    
    @classmethod
    def get_supported_databases(cls) -> List[str]:
        """Retornar lista de bancos suportados"""
        return list(cls._connectors.keys())
