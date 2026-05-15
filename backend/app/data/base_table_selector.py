from .cost_estimator import CostEstimator


def choose_best_base_table(tables, filters, indexes, table_row_counts=None, join_distances=None):
    estimator = CostEstimator()
    join_distances = join_distances or {}

    costs = {
        table: estimator.estimate_table_cost(
            table,
            filters,
            indexes,
            table_row_counts=table_row_counts,
            join_distance=join_distances.get(table, 0),
        )
        for table in tables
    }

    return min(costs, key=costs.get)
