"""
Gerador do dataset sintético de recomendação de gráficos.
Executa a partir da pasta backend/:
    python generate_dataset.py

Regras de negócio por tipo de gráfico
--------------------------------------
Cada classe tem um perfil de features bem definido e separado
das demais, evitando sobreposição que cause confusão no modelo.

Classes (10 — removidas as ambíguas/duplicadas):
  Bar        – cat + num, sem temporal,  baixa cardinalidade
  Line       – temporal + num
  Area       – temporal + num, múltiplos num
  Scatter    – 2+ num sem cat, sem temporal
  Pie        – 1 cat baixa cardinalidade + 1 num, numeric_ratio~0.5
  Heatmap    – 2 cat + num, corr alta, geo possível
  Histograma – 1 num, sem cat, sem temporal, alta card numérica
  Table      – muitas cat + poucos num, alta cardinalidade
  TreeMap    – 1 cat hierárquica + 1 num
  KPI        – 1 num apenas, sem cat, sem temporal (inclui Indicador)
"""

import numpy as np
import pandas as pd
import os
import random

SEED = 42
rng = np.random.default_rng(SEED)
random.seed(SEED)

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "synthetic_viz_dataset_12k.csv")
N_TOTAL = 12_000

# Proporção desejada (relativa) por classe
CLASS_WEIGHTS = {
    "Bar":        3.0,
    "Line":       2.5,
    "Area":       2.0,
    "Scatter":    1.5,
    "Pie":        1.5,
    "Heatmap":    1.2,
    "Histograma": 1.0,
    "Table":      1.0,
    "TreeMap":    0.8,
    "KPI":        0.7,
}

total_w = sum(CLASS_WEIGHTS.values())
CLASS_COUNTS = {k: max(1, round(v / total_w * N_TOTAL)) for k, v in CLASS_WEIGHTS.items()}
# ajuste para bater exatamente N_TOTAL
diff = N_TOTAL - sum(CLASS_COUNTS.values())
CLASS_COUNTS["Bar"] += diff


def clip(v, lo, hi):
    return float(np.clip(v, lo, hi))


def rand(lo, hi):
    return float(rng.uniform(lo, hi))


def rand_int(lo, hi):
    return int(rng.integers(lo, hi + 1))


def noise(scale=0.05):
    return float(rng.normal(0, scale))


FEATURE_COLS = [
    "num_cols", "cat_cols", "temporal_cols", "avg_cardinality",
    "corr_strength", "pct_nulls", "numeric_cardinality_mean",
    "contains_geo", "hierarchical_cat", "numeric_ratio",
]


def make_bar(n):
    rows = []
    for _ in range(n):
        num_cols        = rand_int(1, 3)
        cat_cols        = rand_int(1, 3)
        temporal_cols   = 0
        avg_cardinality = clip(rng.integers(3, 20) + noise(2), 2, 40)
        corr_strength   = clip(rand(0.05, 0.6) + noise(), 0, 1)
        pct_nulls       = clip(rand(0, 0.3) + noise(), 0, 1)
        num_card_mean   = clip(rng.integers(5, 80) + noise(5), 0, 300)
        contains_geo    = int(rng.random() < 0.05)
        hierarchical    = int(rng.random() < 0.10)
        total           = num_cols + cat_cols + temporal_cols
        numeric_ratio   = clip(num_cols / total + noise(0.03), 0, 1)
        rows.append([num_cols, cat_cols, temporal_cols, avg_cardinality,
                     corr_strength, pct_nulls, num_card_mean,
                     contains_geo, hierarchical, numeric_ratio, "Bar"])
    return rows


def make_line(n):
    rows = []
    for _ in range(n):
        num_cols        = rand_int(1, 3)
        cat_cols        = rand_int(0, 1)
        temporal_cols   = rand_int(1, 2)
        avg_cardinality = clip(rng.integers(0, 5) + noise(1), 0, 15)
        corr_strength   = clip(rand(0.1, 0.9) + noise(), 0, 1)
        pct_nulls       = clip(rand(0, 0.25) + noise(), 0, 1)
        num_card_mean   = clip(rng.integers(10, 200) + noise(10), 0, 400)
        contains_geo    = int(rng.random() < 0.05)
        hierarchical    = int(rng.random() < 0.05)
        total           = num_cols + cat_cols + temporal_cols
        numeric_ratio   = clip(num_cols / total + noise(0.03), 0, 1)
        rows.append([num_cols, cat_cols, temporal_cols, avg_cardinality,
                     corr_strength, pct_nulls, num_card_mean,
                     contains_geo, hierarchical, numeric_ratio, "Line"])
    return rows


def make_area(n):
    rows = []
    for _ in range(n):
        num_cols        = rand_int(2, 4)
        cat_cols        = 0
        temporal_cols   = rand_int(1, 2)
        avg_cardinality = clip(rng.integers(0, 3) + noise(1), 0, 10)
        corr_strength   = clip(rand(0.3, 0.95) + noise(), 0, 1)
        pct_nulls       = clip(rand(0, 0.2) + noise(), 0, 1)
        num_card_mean   = clip(rng.integers(20, 300) + noise(15), 0, 500)
        contains_geo    = 0
        hierarchical    = 0
        total           = num_cols + temporal_cols
        numeric_ratio   = clip(num_cols / total + noise(0.02), 0, 1)
        rows.append([num_cols, cat_cols, temporal_cols, avg_cardinality,
                     corr_strength, pct_nulls, num_card_mean,
                     contains_geo, hierarchical, numeric_ratio, "Area"])
    return rows


def make_scatter(n):
    rows = []
    for _ in range(n):
        num_cols        = rand_int(2, 4)
        cat_cols        = 0
        temporal_cols   = 0
        avg_cardinality = 0
        corr_strength   = clip(rand(0.3, 0.99) + noise(), 0, 1)
        pct_nulls       = clip(rand(0, 0.2) + noise(), 0, 1)
        num_card_mean   = clip(rng.integers(30, 300) + noise(20), 5, 500)
        contains_geo    = int(rng.random() < 0.10)
        hierarchical    = 0
        numeric_ratio   = 1.0
        rows.append([num_cols, cat_cols, temporal_cols, avg_cardinality,
                     corr_strength, pct_nulls, num_card_mean,
                     contains_geo, hierarchical, numeric_ratio, "Scatter"])
    return rows


def make_pie(n):
    rows = []
    for _ in range(n):
        num_cols        = 1
        cat_cols        = 1
        temporal_cols   = 0
        avg_cardinality = clip(rng.integers(2, 8) + noise(1), 2, 12)
        corr_strength   = clip(rand(0.0, 0.4) + noise(), 0, 1)
        pct_nulls       = clip(rand(0, 0.2) + noise(), 0, 1)
        num_card_mean   = clip(rng.integers(2, 30) + noise(3), 0, 60)
        contains_geo    = 0
        hierarchical    = 0
        numeric_ratio   = 0.5
        rows.append([num_cols, cat_cols, temporal_cols, avg_cardinality,
                     corr_strength, pct_nulls, num_card_mean,
                     contains_geo, hierarchical, numeric_ratio, "Pie"])
    return rows


def make_heatmap(n):
    rows = []
    for _ in range(n):
        num_cols        = rand_int(1, 2)
        cat_cols        = rand_int(2, 3)
        temporal_cols   = 0
        avg_cardinality = clip(rng.integers(5, 30) + noise(3), 4, 60)
        corr_strength   = clip(rand(0.5, 0.99) + noise(0.05), 0, 1)
        pct_nulls       = clip(rand(0, 0.25) + noise(), 0, 1)
        num_card_mean   = clip(rng.integers(5, 60) + noise(5), 0, 150)
        contains_geo    = int(rng.random() < 0.25)
        hierarchical    = int(rng.random() < 0.05)
        total           = num_cols + cat_cols
        numeric_ratio   = clip(num_cols / total + noise(0.03), 0, 1)
        rows.append([num_cols, cat_cols, temporal_cols, avg_cardinality,
                     corr_strength, pct_nulls, num_card_mean,
                     contains_geo, hierarchical, numeric_ratio, "Heatmap"])
    return rows


def make_histograma(n):
    rows = []
    for _ in range(n):
        num_cols        = 1
        cat_cols        = 0
        temporal_cols   = 0
        avg_cardinality = 0
        corr_strength   = clip(rand(0.0, 0.3) + noise(), 0, 1)
        pct_nulls       = clip(rand(0, 0.15) + noise(), 0, 1)
        num_card_mean   = clip(rng.integers(50, 500) + noise(30), 30, 800)
        contains_geo    = 0
        hierarchical    = 0
        numeric_ratio   = 1.0
        rows.append([num_cols, cat_cols, temporal_cols, avg_cardinality,
                     corr_strength, pct_nulls, num_card_mean,
                     contains_geo, hierarchical, numeric_ratio, "Histograma"])
    return rows


def make_table(n):
    rows = []
    for _ in range(n):
        num_cols        = rand_int(0, 2)
        cat_cols        = rand_int(2, 4)
        temporal_cols   = rand_int(0, 1)
        avg_cardinality = clip(rng.integers(10, 50) + noise(5), 8, 100)
        corr_strength   = clip(rand(0.0, 0.3) + noise(), 0, 1)
        pct_nulls       = clip(rand(0, 0.4) + noise(), 0, 1)
        num_card_mean   = clip(rng.integers(0, 30) + noise(3), 0, 80)
        contains_geo    = int(rng.random() < 0.10)
        hierarchical    = int(rng.random() < 0.20)
        total           = num_cols + cat_cols + temporal_cols
        numeric_ratio   = clip(num_cols / total + noise(0.03) if total > 0 else 0, 0, 1)
        rows.append([num_cols, cat_cols, temporal_cols, avg_cardinality,
                     corr_strength, pct_nulls, num_card_mean,
                     contains_geo, hierarchical, numeric_ratio, "Table"])
    return rows


def make_treemap(n):
    rows = []
    for _ in range(n):
        num_cols        = 1
        cat_cols        = rand_int(1, 2)
        temporal_cols   = 0
        avg_cardinality = clip(rng.integers(3, 15) + noise(2), 2, 30)
        corr_strength   = clip(rand(0.0, 0.5) + noise(), 0, 1)
        pct_nulls       = clip(rand(0, 0.2) + noise(), 0, 1)
        num_card_mean   = clip(rng.integers(5, 50) + noise(5), 0, 120)
        contains_geo    = 0
        hierarchical    = int(rng.random() < 0.80)   # TreeMap é tipicamente hierárquico
        total           = num_cols + cat_cols
        numeric_ratio   = clip(num_cols / total + noise(0.03), 0, 1)
        rows.append([num_cols, cat_cols, temporal_cols, avg_cardinality,
                     corr_strength, pct_nulls, num_card_mean,
                     contains_geo, hierarchical, numeric_ratio, "TreeMap"])
    return rows


def make_kpi(n):
    rows = []
    for _ in range(n):
        num_cols        = 1
        cat_cols        = 0
        temporal_cols   = 0
        avg_cardinality = 0
        corr_strength   = clip(rand(0.0, 0.2) + noise(), 0, 1)
        pct_nulls       = clip(rand(0, 0.1) + noise(), 0, 1)
        num_card_mean   = clip(rng.integers(1, 10) + noise(1), 1, 20)
        contains_geo    = 0
        hierarchical    = 0
        numeric_ratio   = 1.0
        rows.append([num_cols, cat_cols, temporal_cols, avg_cardinality,
                     corr_strength, pct_nulls, num_card_mean,
                     contains_geo, hierarchical, numeric_ratio, "KPI"])
    return rows


GENERATORS = {
    "Bar":        make_bar,
    "Line":       make_line,
    "Area":       make_area,
    "Scatter":    make_scatter,
    "Pie":        make_pie,
    "Heatmap":    make_heatmap,
    "Histograma": make_histograma,
    "Table":      make_table,
    "TreeMap":    make_treemap,
    "KPI":        make_kpi,
}


def main():
    all_rows = []
    for cls, count in CLASS_COUNTS.items():
        print(f"  Gerando {count:5d} amostras para '{cls}'...")
        rows = GENERATORS[cls](count)
        all_rows.extend(rows)

    df = pd.DataFrame(all_rows, columns=FEATURE_COLS + ["chart_type"])
    df = df.sample(frac=1, random_state=SEED).reset_index(drop=True)

    df.to_csv(OUTPUT_PATH, index=False)
    print(f"\nDataset salvo em: {OUTPUT_PATH}")
    print(f"Total de amostras: {len(df)}")
    print("\nDistribuicao:")
    print(df["chart_type"].value_counts().to_string())


if __name__ == "__main__":
    main()
