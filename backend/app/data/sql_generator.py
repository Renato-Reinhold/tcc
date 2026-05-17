from app.data.relationship_graph import find_join_path
from app.data.chart_query_builder import ChartQueryBuilder, _build_filter_clauses


class SQLGenerator:

    def __init__(self):
        self._builder = ChartQueryBuilder()

    def generate(
        self,
        query,
        graph,
        base_table,
        cost_estimator=None,
        index_metadata=None,
        table_row_counts=None,
    ):
        """Generate chart-type-aware SQL from a QueryModel.

        Quando *cost_estimator* é fornecido, o caminho de JOINs é resolvido
        via Dijkstra ponderado pelo custo estimado de cada tabela; caso
        contrário, usa BFS (menor número de JOINs).
        """
        chart_type = getattr(query, "chart_type", "bar")

        x_col = query.group_by[0] if query.group_by else base_table
        z_col = getattr(query, "z_column", None)

        agg_func = "sum"
        y_col = ""
        if query.aggregations:
            agg = query.aggregations[0]
            y_col = agg["field"] if isinstance(agg, dict) else agg.field
            agg_func = (agg["func"] if isinstance(agg, dict) else agg.func) or "sum"

        # Constrói strings "tabela.coluna" para repassar ao estimador de custo
        filter_strings = _extract_filter_strings(query.filters or [])

        # Build JOIN clauses from relationship graph (optional)
        joins_parts = []
        used_tables = {base_table}
        if graph is not None:
            for table in query.tables:
                if table == base_table:
                    continue
                try:
                    path = find_join_path(
                        graph,
                        base_table,
                        table,
                        cost_estimator=cost_estimator,
                        filters=filter_strings,
                        indexes=index_metadata or [],
                        table_row_counts=table_row_counts,
                    )
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


def _extract_filter_strings(filters) -> list:
    """Converte filtros da query para o formato 'tabela.coluna' esperado
    pelo CostEstimator. Suporta dicts e objetos com atributos."""
    result = []
    for f in filters:
        if isinstance(f, dict):
            table = f.get("table", "")
            column = f.get("column", "")
        else:
            table = getattr(f, "table", "")
            column = getattr(f, "column", "")
        if table and column:
            result.append(f"{table}.{column}")
    return result
