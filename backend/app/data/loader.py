import pandas as pd
import os
from sqlalchemy import create_engine, inspect
from app.config.settings import settings

class DataLoader:

    def __init__(self):
        self.engine = create_engine(settings.DB_URL)
        self.dataframes_cache = {}

    def load_table(self, table_name: str):
        query = f"SELECT * FROM {table_name}"
        return pd.read_sql(query, self.engine)

    def execute_sql(self, sql: str):
        return pd.read_sql(sql, self.engine)

    def load_data(self):
        """
        Carrega dados de arquivos CSV/XLS
        Retorna um dicionário de DataFrames
        """
        if self.dataframes_cache:
            return self.dataframes_cache
        
        data_dir = os.path.join(os.path.dirname(__file__), '..', '..')
        
        # Procurar por arquivos CSV
        for file in os.listdir(data_dir):
            if file.endswith('.csv'):
                table_name = file.replace('.csv', '')
                try:
                    self.dataframes_cache[table_name] = pd.read_csv(
                        os.path.join(data_dir, file)
                    )
                except Exception as e:
                    print(f"Erro ao carregar {file}: {e}")
            elif file.endswith('.xlsx') or file.endswith('.xls'):
                table_name = file.replace('.xlsx', '').replace('.xls', '')
                try:
                    self.dataframes_cache[table_name] = pd.read_excel(
                        os.path.join(data_dir, file)
                    )
                except Exception as e:
                    print(f"Erro ao carregar {file}: {e}")
        
        return self.dataframes_cache

    def get_tables_metadata(self):
        """
        Retorna metadados das tabelas disponíveis
        """
        inspector = inspect(self.engine)
        tables = inspector.get_table_names()
        
        metadata = {
            'tables': []
        }
        
        for table_name in tables:
            columns = inspector.get_columns(table_name)
            metadata['tables'].append({
                'name': table_name,
                'columns': [
                    {
                        'name': col['name'],
                        'type': str(col['type'])
                    }
                    for col in columns
                ]
            })
        
        return metadata
