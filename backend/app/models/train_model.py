import joblib
from app.models.boosted_tree import BoostedTreeModel
from app.config.settings import settings
import os


class Trainer:

    def train(self, X, y, params=None):
        model = BoostedTreeModel(params=params)
        model.fit(X, y)

        os.makedirs(settings.MODEL_DIR, exist_ok=True)
        model.save()

        return model

    def load(self):
        model = BoostedTreeModel()
        model.load()
        return model
