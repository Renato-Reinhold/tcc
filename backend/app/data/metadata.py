import pandas as pd
from typing import List, Dict, Any

class ColumnMetadata:
    def __init__(self, name, dtype, unique_count=None):
        self.name = name
        self.dtype = dtype
        self.unique_count = unique_count


class TableMetadata:
    def __init__(self, name, primary_key):
        self.name = name
        self.primary_key = primary_key
        self.foreign_keys = []


class ForeignKeyMetadata:
    def __init__(self, column, ref_table, ref_column):
        self.column = column
        self.ref_table = ref_table
        self.ref_column = ref_column


class IndexMetadata:
    def __init__(self, table, column, unique=False):
        self.table = table
        self.column = column
        self.unique = unique


def extract_metadata(df: pd.DataFrame, columns: List[str]) -> Dict[str, Any]:
    """
    Extrai metadados de um DataFrame para uso na recomendação de gráficos
    """
    metadata = {
        'columns': [],
        'numeric_cols': [],
        'categorical_cols': [],
        'date_cols': [],
        'row_count': len(df),
        'col_count': len(columns)
    }
    
    for col in columns:
        if col in df.columns:
            dtype = str(df[col].dtype)
            unique_count = df[col].nunique()
            
            col_info = {
                'name': col,
                'dtype': dtype,
                'unique_count': unique_count,
                'null_count': df[col].isnull().sum()
            }
            
            # Classificar coluna
            if pd.api.types.is_numeric_dtype(df[col]):
                metadata['numeric_cols'].append(col)
                col_info['type'] = 'numeric'
                col_info['min'] = float(df[col].min())
                col_info['max'] = float(df[col].max())
                col_info['mean'] = float(df[col].mean())
            elif pd.api.types.is_datetime64_any_dtype(df[col]):
                metadata['date_cols'].append(col)
                col_info['type'] = 'date'
            else:
                metadata['categorical_cols'].append(col)
                col_info['type'] = 'categorical'
                col_info['top_values'] = df[col].value_counts().head(5).to_dict()
            
            metadata['columns'].append(col_info)
    
    return metadata
