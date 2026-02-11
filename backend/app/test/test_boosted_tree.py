import numpy as np
from app.models.boosted_tree import BoostedTreeModel

def test_xgboost_train_predict():
    X = np.array([[1], [2], [3], [4]])
    y = np.array([2, 4, 6, 8])

    model = BoostedTreeModel()
    model.fit(X, y)

    pred = model.predict(X)

    assert len(pred) == 4
    assert min(pred) > 0
