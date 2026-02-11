import pandas as pd

class Preprocessor:

    def clean(self, df: pd.DataFrame):
        df = df.copy()
        df = df.dropna(axis=1, how="all")
        df = df.fillna(0)
        return df

    def encode(self, df: pd.DataFrame):
        df = df.copy()
        for col in df.select_dtypes(include=["object"]).columns:
            df[col] = df[col].astype("category").cat.codes
        return df
