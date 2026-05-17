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
    num_cols        = int(metadata.get("num_cols", 0))
    cat_cols        = int(metadata.get("cat_cols", 0))
    temporal_cols   = int(metadata.get("temporal_cols", 0))
    contains_geo    = int(metadata.get("contains_geo", 0))
    hierarchical    = int(metadata.get("hierarchical_cat", 0))
    avg_cardinality = float(metadata.get("avg_cardinality", 0))
    corr_strength   = float(metadata.get("corr_strength", 0))

    # Geo → Mapa
    if contains_geo:
        return "Map"
    # Temporal → Área (multi-série) ou Linha
    if temporal_cols > 0 and num_cols >= 2:
        return "Area"
    if temporal_cols > 0:
        return "Line"
    # Muitas métricas + 1 categoria → Radar
    if num_cols >= 3 and cat_cols == 1:
        return "Radar"
    # Hierárquico + 1 num → TreeMap
    if hierarchical and num_cols == 1:
        return "TreeMap"
    # 2 categorias + 1 num → Tabela Dinâmica
    if cat_cols >= 2 and num_cols >= 1:
        return "PivotTable"
    # 2+ numéricos sem categoria → Scatter
    if num_cols >= 2 and cat_cols == 0:
        return "Scatter"
    # 1 num pura (sem cat, sem temporal) → KPI
    if num_cols == 1 and cat_cols == 0 and temporal_cols == 0:
        return "KPI"
    # Distribuição contínua de 1 num → Histograma
    if num_cols == 1 and cat_cols == 0:
        return "Histograma"
    # 1 cat + 1 num: Pareto (poucos itens, baixa correlação) ou Pie (cardinalidade mínima)
    if num_cols == 1 and cat_cols == 1:
        if avg_cardinality <= 8 and corr_strength < 0.3:
            return "Pie"
        if avg_cardinality <= 20 and corr_strength < 0.2:
            return "Pareto"
    # Correlação alta entre 2 cats → Heatmap
    if cat_cols >= 2 and corr_strength >= 0.6:
        return "Heatmap"
    # Fallback
    return "Bar"

