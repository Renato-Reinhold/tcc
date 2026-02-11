class AggregationInferer:

    def infer(self, x_col, y_col):
        group_by = []
        aggregations = []

        if x_col.dtype == "categorical":
            group_by.append(x_col.name)

        if x_col.dtype == "datetime":
            group_by.append(f"DATE_TRUNC('month', {x_col.name})")

        if y_col.dtype == "numeric":
            aggregations.append({
                "field": y_col.name,
                "func": "SUM"
            })

        return group_by, aggregations
