import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, classification_report
from app.models.boosted_tree import BoostedTreeModel
from app.config.settings import settings
from app.utils.logger import logger


class Trainer:

    def train(self, X, y, params=None, test_size=0.2):
        # Split estratificado para preservar proporção das classes
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=test_size,
            random_state=42,
            stratify=y,
        )

        model = BoostedTreeModel(params=params)
        model.fit(X_train, y_train, X_val=X_test, y_val=y_test)

        # Avaliação
        y_pred = model.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        f1_w = f1_score(y_test, y_pred, average="weighted", zero_division=0)
        f1_m = f1_score(y_test, y_pred, average="macro", zero_division=0)

        logger.info("=== Resultado do Treino ===")
        logger.info(f"Accuracy:        {acc:.4f}")
        logger.info(f"F1 (weighted):   {f1_w:.4f}")
        logger.info(f"F1 (macro):      {f1_m:.4f}")
        logger.info("Relatório por classe:\n" + classification_report(y_test, y_pred, zero_division=0))

        model.save()

        return model, {
            "accuracy": acc,
            "f1_weighted": f1_w,
            "f1_macro": f1_m,
            "train_size": len(X_train),
            "test_size": len(X_test),
        }

    def load(self):
        model = BoostedTreeModel()
        model.load()
        return model
