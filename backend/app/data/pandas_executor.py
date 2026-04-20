from app.data.chart_query_builder import ChartQueryBuilder


class PandasExecutor:

    def __init__(self):
        self._builder = ChartQueryBuilder()

    def execute(self, dataframes, query):
        """Execute a chart-type-aware transformation on an in-memory DataFrame."""
        table_name = query.tables[0]
        if table_name not in dataframes:
            # Fallback to first available table
            df = next(iter(dataframes.values()))
        else:
            df = dataframes[table_name]

        chart_type = getattr(query, "chart_type", "bar")
        x_col = query.x_column or (query.group_by[0] if query.group_by else "")
        z_col = getattr(query, "z_column", None)

        agg_func = "sum"
        y_col = ""
        if query.aggregations:
            agg = query.aggregations[0]
            y_col = agg["field"] if isinstance(agg, dict) else agg.field
            agg_func = agg["func"] if isinstance(agg, dict) else agg.func

        return self._builder.build_pandas(
            chart_type=chart_type,
            df=df,
            x_col=x_col,
            y_col=y_col,
            agg_func=agg_func,
            z_col=z_col,
        )
