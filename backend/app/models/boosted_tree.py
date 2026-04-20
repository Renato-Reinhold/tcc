import xgboost as xgb
import joblib
import numpy as np
import os
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_sample_weight
from app.config.settings import settings


class BoostedTreeModel:

    def __init__(self, params=None):
        # parâmetros padrão para classificação multi-classe
        default_params = {
            "n_estimators": 300,
            "learning_rate": 0.05,
            "max_depth": 5,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "min_child_weight": 3,
            "gamma": 0.1,
            "reg_alpha": 0.1,
            "reg_lambda": 1.0,
            "objective": "multi:softprob",
            "eval_metric": "mlogloss",
            "early_stopping_rounds": 20,
            "random_state": 42,
        }

        # junta params do usuário com padrão
        if params:
            default_params.update(params)

        self.params = default_params
        self.label_encoder = LabelEncoder()
        self.model = xgb.XGBClassifier(**{
            k: v for k, v in self.params.items()
        })
        self.classes_ = None

    def fit(self, X, y, X_val=None, y_val=None):
        # Codifica as classes (string → int)
        y_enc = self.label_encoder.fit_transform(y)
        self.classes_ = self.label_encoder.classes_
        self.model.set_params(num_class=len(self.classes_))

        # Peso de amostra para lidar com desbalanceamento
        sample_weights = compute_sample_weight("balanced", y_enc)

        eval_set = None
        if X_val is not None and y_val is not None:
            y_val_enc = self.label_encoder.transform(y_val)
            eval_set = [(X_val, y_val_enc)]
        else:
            # Sem validation set, desabilitar early stopping
            self.model.set_params(early_stopping_rounds=None)

        self.model.fit(
            X, y_enc,
            sample_weight=sample_weights,
            eval_set=eval_set,
            verbose=False,
        )

    def predict(self, X):
        y_enc = self.model.predict(X)
        return self.label_encoder.inverse_transform(y_enc)

    def predict_proba(self, X):
        """Retorna probabilidades para cada classe."""
        proba = self.model.predict_proba(X)
        return proba, self.classes_.tolist()

    def predict_top_k(self, X, k=3):
        """Retorna as top-k classes com suas probabilidades."""
        proba, classes = self.predict_proba(X)
        results = []
        for row in proba:
            top_idx = np.argsort(row)[::-1][:k]
            results.append([
                {"chart_type": classes[i], "probability": float(row[i])}
                for i in top_idx
            ])
        return results

    def feature_importances(self):
        return dict(zip(
            getattr(self.model, "feature_names_in_", [f"f{i}" for i in range(len(self.model.feature_importances_))]),
            self.model.feature_importances_.tolist()
        ))

    def save(self, model_dir=None):
        directory = model_dir or settings.MODEL_DIR
        os.makedirs(directory, exist_ok=True)
        self.model.save_model(os.path.join(directory, "model.json"))
        joblib.dump(self.label_encoder, os.path.join(directory, "label_encoder.pkl"))

    def load(self, model_dir=None):
        directory = model_dir or settings.MODEL_DIR
        self.model.load_model(os.path.join(directory, "model.json"))
        self.label_encoder = joblib.load(os.path.join(directory, "label_encoder.pkl"))
        self.classes_ = self.label_encoder.classes_
