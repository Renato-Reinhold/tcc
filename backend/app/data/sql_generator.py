from app.data.relationship_graph import find_join_path

class SQLGenerator:

    def generate(self, query, graph, base_table):
        select_parts = []
        from_clause = base_table

        # SELECT
        select_parts.extend(query.group_by)

        for agg in query.aggregations:
            select_parts.append(
                f"{agg['func']}({agg['field']})"
            )

        select_clause = ", ".join(select_parts)

        # JOIN
        joins = []
        used_tables = {base_table}

        for table in query.tables:
            if table == base_table:
                continue

            path = find_join_path(graph, base_table, table)

            for from_t, to_t, from_col, to_col in path:
                if to_t not in used_tables:
                    joins.append(
                        f"JOIN {to_t} ON {from_col} = {to_col}"
                    )
                    used_tables.add(to_t)

        # SQL final
        sql = f"SELECT {select_clause} FROM {from_clause} {' '.join(joins)}"

        if query.filters:
            sql += " WHERE " + " AND ".join(query.filters)

        if query.group_by:
            sql += " GROUP BY " + ", ".join(query.group_by)

        return sql
