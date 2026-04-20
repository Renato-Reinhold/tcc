import pandas as pd
import numpy as np
from app.utils.logger import logger

# Carregamento lazy do modelo para não bloquear startup
_model = None
_preprocessor = None


def _load_model():
    global _model, _preprocessor
    if _model is not None:
        return _model, _preprocessor
    try:
        from app.models.train_model import Trainer
        from app.data.preprocessor import Preprocessor
        from app.config.settings import settings

        _preprocessor = Preprocessor.load(settings.MODEL_DIR)
        _model = Trainer().load()
        logger.info("Modelo BoostedTree carregado com sucesso.")
    except Exception as e:
        logger.warning(f"Modelo não encontrado ou falha ao carregar ({e}). Usando regras.")
        _model = None
        _preprocessor = None
    return _model, _preprocessor


def recommend_chart(metadata: dict) -> str:
    """
    Recomenda um tipo de gráfico dado um dict de metadata.
    Tenta usar o modelo; em caso de falha, usa regras.

    metadata esperado:
        num_cols, cat_cols, temporal_cols, avg_cardinality,
        corr_strength, pct_nulls, numeric_cardinality_mean,
        contains_geo, hierarchical_cat, numeric_ratio
    """
    model, preprocessor = _load_model()

    if model is not None and preprocessor is not None:
        try:
            df = pd.DataFrame([metadata])
            X = preprocessor.transform(df)
            predictions = model.predict_top_k(X, k=1)
            return predictions[0][0]["chart_type"]
        except Exception as e:
            logger.warning(f"Falha na predição ML ({e}). Usando regras.")

    return _rule_based_recommend(metadata)


def recommend_chart_top_k(metadata: dict, k: int = 3) -> list:
    """
    Retorna as top-k recomendações com probabilidades.
    Retorna lista de dicts: [{"chart_type": str, "probability": float}, ...]
    """
    model, preprocessor = _load_model()

    if model is not None and preprocessor is not None:
        try:
            df = pd.DataFrame([metadata])
            X = preprocessor.transform(df)
            predictions = model.predict_top_k(X, k=k)
            return predictions[0]
        except Exception as e:
            logger.warning(f"Falha na predição ML top-k ({e}). Usando regras.")

    chart = _rule_based_recommend(metadata)
    return [{"chart_type": chart, "probability": 1.0}]


def _rule_based_recommend(metadata: dict) -> str:
    """Fallback baseado em regras simples."""
    x_type = metadata.get("x_type", "")
    y_type = metadata.get("y_type", "")

    if x_type == "numeric" and y_type == "numeric":
        return "Scatter"
    if x_type == "categorical" and y_type == "numeric":
        return "Bar"
    if metadata.get("temporal_cols", 0) > 0:
        return "Line"
    return "Bar"

