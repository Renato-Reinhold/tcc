from app.data.relationship_graph import find_join_path
from app.data.chart_query_builder import ChartQueryBuilder, _build_filter_clauses


class SQLGenerator:

    def __init__(self):
        self._builder = ChartQueryBuilder()

    def generate(self, query, graph, base_table):
        """Generate chart-type-aware SQL from a QueryModel."""
        chart_type = getattr(query, "chart_type", "bar")

        x_col = query.group_by[0] if query.group_by else base_table
        z_col = getattr(query, "z_column", None)

        agg_func = "sum"
        y_col = ""
        if query.aggregations:
            agg = query.aggregations[0]
            y_col = agg["field"] if isinstance(agg, dict) else agg.field
            agg_func = (agg["func"] if isinstance(agg, dict) else agg.func) or "sum"

        # Build JOIN clauses from relationship graph (optional)
        joins_parts = []
        used_tables = {base_table}
        if graph is not None:
            for table in query.tables:
                if table == base_table:
                    continue
                try:
                    path = find_join_path(graph, base_table, table)
                    for from_t, to_t, from_col, to_col in path:
                        if to_t not in used_tables:
                            joins_parts.append(f"JOIN {to_t} ON {from_col} = {to_col}")
                            used_tables.add(to_t)
                except Exception:
                    pass
        joins_str = " ".join(joins_parts)

        # Convert FilterRequest / dict filters to SQL clause strings
        filter_clauses = _build_filter_clauses(query.filters or [])

        return self._builder.build_sql(
            chart_type=chart_type,
            base_table=base_table,
            x_col=x_col,
            y_col=y_col,
            agg_func=agg_func,
            z_col=z_col,
            filters=filter_clauses,
            joins=joins_str,
        )
