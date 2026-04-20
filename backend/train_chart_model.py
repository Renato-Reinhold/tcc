"""
Script de treino do modelo de recomendação de gráficos.
Execute a partir da pasta backend/:
    python train_chart_model.py
"""
import sys
import os

# Garantir que o módulo app seja encontrado
sys.path.insert(0, os.path.dirname(__file__))

import pandas as pd
from app.data.preprocessor import Preprocessor
from app.models.train_model import Trainer
from app.config.settings import settings

DATASET_PATH = os.path.join(os.path.dirname(__file__), "synthetic_viz_dataset_12k.csv")
TARGET_COL = "chart_type"


def main():
    print(f"[1/4] Carregando dataset: {DATASET_PATH}")
    df = pd.read_csv(DATASET_PATH)
    print(f"      {len(df)} amostras, colunas: {list(df.columns)}")

    print("[2/4] Pré-processando features...")
    preprocessor = Preprocessor()
    X = preprocessor.fit_transform(df.drop(columns=[TARGET_COL]))
    y = df[TARGET_COL].values
    print(f"      Features: {list(X.columns)}")

    print("[3/4] Treinando modelo XGBoost Classifier...")
    trainer = Trainer()
    model, metrics = trainer.train(X.values, y)

    print("\n[4/4] Salvando preprocessor...")
    preprocessor.save(settings.MODEL_DIR)
    print(f"      Modelo salvo em: {settings.MODEL_DIR}")

    print("\n=== Métricas Finais ===")
    for k, v in metrics.items():
        if isinstance(v, float):
            print(f"  {k}: {v:.4f}")
        else:
            print(f"  {k}: {v}")

    print("\nTreino concluído!")


if __name__ == "__main__":
    main()
