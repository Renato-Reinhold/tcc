import xgboost as xgb
import joblib
import numpy as np
from app.config.settings import settings


class BoostedTreeModel:

    def __init__(self, params=None):
        # parâmetros padrão
        default_params = {
            "n_estimators": 120,
            "learning_rate": 0.05,
            "max_depth": 4,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "objective": "reg:squarederror",
            "eval_metric": "rmse"
        }

        # junta params do usuário com padrão
        if params:
            default_params.update(params)

        self.params = default_params
        self.model = xgb.XGBRegressor(**self.params)

    def fit(self, X, y):
        self.model.fit(X, y)

    def predict(self, X):
        return self.model.predict(X)

    def save(self, filename=f"{settings.MODEL_DIR}/model.json"):
        self.model.save_model(filename)

    def load(self, filename=f"{settings.MODEL_DIR}/model.json"):
        self.model.load_model(filename)
