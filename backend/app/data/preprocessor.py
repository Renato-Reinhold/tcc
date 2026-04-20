import pandas as pd
import joblib
import os
from sklearn.preprocessing import OrdinalEncoder


class Preprocessor:

    # Colunas de features esperadas pelo modelo (ordem fixa)
    FEATURE_COLUMNS = [
        "num_cols",
        "cat_cols",
        "temporal_cols",
        "avg_cardinality",
        "corr_strength",
        "pct_nulls",
        "numeric_cardinality_mean",
        "contains_geo",
        "hierarchical_cat",
        "numeric_ratio",
        # features sintéticas
        "total_cols",
        "cat_times_cardinality",
    ]

    def __init__(self):
        self._cat_encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
        self._fitted = False

    def _add_synthetic_features(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        # Garantir que colunas base existam antes de criar features sintéticas
        for col in ["num_cols", "cat_cols", "temporal_cols", "avg_cardinality"]:
            if col not in df.columns:
                df[col] = 0
        df["total_cols"] = df["num_cols"] + df["cat_cols"] + df["temporal_cols"]
        df["cat_times_cardinality"] = df["cat_cols"] * df["avg_cardinality"]
        return df

    def clean(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df = df.dropna(axis=1, how="all")
        df = df.fillna(0)
        return df

    def fit_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Limpa, adiciona features sintéticas e retorna o DataFrame pronto para treino."""
        df = self.clean(df)
        df = self._add_synthetic_features(df)
        self._fitted = True
        return df[self.FEATURE_COLUMNS]

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Transforma novos dados usando o mesmo pipeline."""
        df = self.clean(df)
        df = self._add_synthetic_features(df)
        # Garantir colunas ausentes com 0
        for col in self.FEATURE_COLUMNS:
            if col not in df.columns:
                df[col] = 0
        return df[self.FEATURE_COLUMNS]

    def save(self, directory: str):
        os.makedirs(directory, exist_ok=True)
        joblib.dump(self, os.path.join(directory, "preprocessor.pkl"))

    @staticmethod
    def load(directory: str) -> "Preprocessor":
        return joblib.load(os.path.join(directory, "preprocessor.pkl"))

