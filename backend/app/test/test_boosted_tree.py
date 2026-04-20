import numpy as np
import pandas as pd
import pytest
from app.models.boosted_tree import BoostedTreeModel
from app.data.preprocessor import Preprocessor


# ---------- Fixtures ----------

@pytest.fixture
def sample_data():
    """Dataset mínimo representando features reais do modelo."""
    data = {
        "num_cols":                [2, 0, 1, 2, 1],
        "cat_cols":                [0, 1, 1, 0, 0],
        "temporal_cols":           [0, 0, 0, 1, 0],
        "avg_cardinality":         [0, 9, 2, 0, 0],
        "corr_strength":           [0.47, 0.38, 0.28, 0.85, 0.10],
        "pct_nulls":               [0.17, 0.02, 0.34, 0.26, 0.21],
        "numeric_cardinality_mean":[48, 0, 17, 17, 103],
        "contains_geo":            [0, 1, 0, 1, 0],
        "hierarchical_cat":        [0, 0, 0, 0, 0],
        "numeric_ratio":           [1.0, 0.0, 0.5, 0.67, 0.67],
    }
    labels = ["Scatter", "Heatmap", "Pie", "Line", "Bar"]
    return pd.DataFrame(data), np.array(labels)


# ---------- Testes do Preprocessor ----------

def test_preprocessor_adds_synthetic_features(sample_data):
    df, _ = sample_data
    p = Preprocessor()
    result = p.fit_transform(df)

    assert "total_cols" in result.columns
    assert "cat_times_cardinality" in result.columns
    assert list(result.columns) == Preprocessor.FEATURE_COLUMNS
    assert result.shape == (5, len(Preprocessor.FEATURE_COLUMNS))


def test_preprocessor_transform_fills_missing_cols():
    df = pd.DataFrame({"num_cols": [1], "cat_cols": [0]})
    p = Preprocessor()
    result = p.transform(df)
    assert result.shape[1] == len(Preprocessor.FEATURE_COLUMNS)


# ---------- Testes do BoostedTreeModel ----------

def test_model_trains_and_predicts(sample_data, tmp_path):
    df, y = sample_data
    p = Preprocessor()
    X = p.fit_transform(df).values

    model = BoostedTreeModel()
    model.fit(X, y)

    preds = model.predict(X)
    assert len(preds) == len(y)
    assert all(pred in model.classes_ for pred in preds)


def test_model_predict_proba_shape(sample_data):
    df, y = sample_data
    p = Preprocessor()
    X = p.fit_transform(df).values

    model = BoostedTreeModel()
    model.fit(X, y)

    proba, classes = model.predict_proba(X)
    assert proba.shape == (len(y), len(np.unique(y)))
    assert len(classes) == len(np.unique(y))


def test_model_predict_top_k(sample_data):
    df, y = sample_data
    p = Preprocessor()
    X = p.fit_transform(df).values

    model = BoostedTreeModel()
    model.fit(X, y)

    top3 = model.predict_top_k(X, k=3)
    assert len(top3) == len(y)
    for row in top3:
        assert len(row) == min(3, len(np.unique(y)))
        for item in row:
            assert "chart_type" in item
            assert "probability" in item
            assert 0.0 <= item["probability"] <= 1.0


def test_model_save_and_load(sample_data, tmp_path):
    df, y = sample_data
    p = Preprocessor()
    X = p.fit_transform(df).values

    model = BoostedTreeModel()
    model.fit(X, y)

    model.save(model_dir=str(tmp_path))

    loaded = BoostedTreeModel()
    loaded.load(model_dir=str(tmp_path))

    preds_original = model.predict(X)
    preds_loaded = loaded.predict(X)
    assert list(preds_original) == list(preds_loaded)


def test_feature_importances(sample_data):
    df, y = sample_data
    p = Preprocessor()
    X = p.fit_transform(df)

    model = BoostedTreeModel()
    # Passar DataFrame para XGBoost preservar feature_names_in_
    model.fit(X, y)

    importances = model.feature_importances()
    assert isinstance(importances, dict)
    assert len(importances) == len(Preprocessor.FEATURE_COLUMNS)

