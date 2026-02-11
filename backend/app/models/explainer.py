import numpy as np

class Explainer:

    def feature_importances(self, model):
        return model.model.feature_importances_.tolist()
