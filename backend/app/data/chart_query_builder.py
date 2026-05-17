import re
from typing import Optional, List

import pandas as pd

# ── Identifier safety ────────────────────────────────────────────────────────

_IDENT_RE = re.compile(r"^[\w.]+$")


def _safe_ident(name: str) -> str:
    """Validate a SQL identifier (allows schema.table and table.column)."""
    if not name or not _IDENT_RE.match(name):
        raise ValueError(f"Unsafe or empty SQL identifier: {name!r}")
    return name


# ── Default per-chart row limits ─────────────────────────────────────────────

_DEFAULT_LIMITS = {
    "bar":        None,
    "column":     None,
    "line":       None,
    "area":       None,
    "scatter":    None,
    "pie":        None,
    "histogram":  None,
    "heatmap":    None,
    "treemap":    None,
    "pareto":     None,
    "kpi":        None,
    "indicador":  None,
    "pivottable": None,
    "radar":      None,
    "map":        None,
    "table":      None,
}

# ── Chart-type aliases (normalise incoming names) ────────────────────────────

_CHART_ALIASES = {
    "column":              "bar",
    "indicador":           "kpi",
    "indicator":           "kpi",
    "pivot tables":        "pivottable",
    "pivot table":         "pivottable",
    "pareto chart":        "pareto",
    "gráfico de pareto":   "pareto",
}


def normalize_chart_type(chart_type: str) -> str:
    t = (chart_type or "bar").lower().strip()
    return _CHART_ALIASES.get(t, t)


# ── Safety cap for raw (non-aggregated) Pandas methods ───────────────────────
# Aggregated methods (bar, line, pie, …) do not need a cap because GROUP BY
# already bounds the row count to the column's cardinality.
# Raw methods (scatter, histogram) use random sampling up to this limit so
# the result is representative rather than positionally biased.
_RAW_SAMPLE_ROWS = 50_000


# ── SQL helpers ───────────────────────────────────────────────────────────────

def _agg_expr(agg_func: str, col: str) -> str:
    """Return a SQL aggregation expression, e.g. SUM(col)."""
    if not col:
        return "COUNT(*)"
    safe_col = _safe_ident(col)
    af = (agg_func or "sum").upper().strip()
    if af == "COUNT_DISTINCT":
        return f"COUNT(DISTINCT {safe_col})"
    valid = {"SUM", "AVG", "COUNT", "MIN", "MAX"}
    af = af if af in valid else "SUM"
    return f"{af}({safe_col})"


def _where(filters: List[str]) -> str:
    if not filters:
        return ""
    return " WHERE " + " AND ".join(filters)


def _build_filter_clauses(filters) -> List[str]:
    """Convert FilterRequest objects (or dicts) to safe SQL WHERE clause strings."""
    op_map = {"eq": "=", "gt": ">", "lt": "<", "gte": ">=", "lte": "<=", "like": "LIKE"}
    clauses: List[str] = []

    for f in (filters or []):
        try:
            field = f.field if hasattr(f, "field") else f.get("field", "")
            operator = f.operator if hasattr(f, "operator") else f.get("operator", "eq")
            value = f.value if hasattr(f, "value") else f.get("value", "")

            safe_field = _safe_ident(field)

            if operator == "in":
                if isinstance(value, (list, tuple)):
                    escaped = ", ".join(
                        f"'{str(v).replace(chr(39), chr(39)*2)}'" for v in value
                    )
                    clauses.append(f"{safe_field} IN ({escaped})")
            elif operator in op_map:
                sql_op = op_map[operator]
                if isinstance(value, str):
                    escaped = value.replace("'", "''")
                    clauses.append(f"{safe_field} {sql_op} '{escaped}'")
                elif isinstance(value, (int, float, bool)):
                    clauses.append(f"{safe_field} {sql_op} {value}")
        except (ValueError, AttributeError):
            pass  # skip invalid/unsafe filters

    return clauses


# ── ChartQueryBuilder ─────────────────────────────────────────────────────────

class ChartQueryBuilder:
    """Builds SQL strings and Pandas transformations tailored to each chart type."""

    # ── Public API ────────────────────────────────────────────────────────────

    def build_sql(
        self,
        chart_type: str,
        base_table: str,
        x_col: str,
        y_col: str,
        agg_func: str = "sum",
        z_col: Optional[str] = None,
        filters: Optional[List[str]] = None,
        joins: str = "",
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> str:
        ct = normalize_chart_type(chart_type)
        effective_limit = limit if limit is not None else _DEFAULT_LIMITS.get(ct)
        method = getattr(self, f"_sql_{ct}", self._sql_bar)
        return method(
            base_table=base_table,
            x_col=x_col,
            y_col=y_col,
            agg_func=agg_func,
            z_col=z_col,
            filters=list(filters or []),
            joins=joins,
            limit=effective_limit,
            offset=offset,
        )

    def build_pandas(
        self,
        chart_type: str,
        df: pd.DataFrame,
        x_col: str,
        y_col: str,
        agg_func: str = "sum",
        z_col: Optional[str] = None,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> pd.DataFrame:
        ct = normalize_chart_type(chart_type)
        effective_limit = limit if limit is not None else _DEFAULT_LIMITS.get(ct)
        method = getattr(self, f"_pandas_{ct}", self._pandas_bar)
        return method(
            df=df,
            x_col=x_col,
            y_col=y_col,
            agg_func=agg_func,
            z_col=z_col,
            limit=effective_limit,
            offset=offset,
        )

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _apply_agg(
        self,
        df: pd.DataFrame,
        group_cols: List[str],
        value_col: str,
        agg_func: str,
        alias: str = "value",
    ) -> pd.DataFrame:
        """Group df by group_cols and aggregate value_col. Renames result to alias."""
        af = (agg_func or "sum").lower().strip()
        agg_map = {
            "sum": "sum",
            "avg": "mean",
            "mean": "mean",
            "count": "count",
            "min": "min",
            "max": "max",
            "count_distinct": pd.Series.nunique,
        }
        fn = agg_map.get(af, "sum")

        missing = [c for c in group_cols + [value_col] if c not in df.columns]
        if missing:
            return df.copy()

        result = df.groupby(group_cols)[value_col].agg(fn).reset_index()
        result.columns = list(group_cols) + [alias]
        return result

    def _best_numeric(self, df: pd.DataFrame, preferred: str) -> Optional[str]:
        """Return preferred if it's numeric in df, else first numeric column, else None."""
        if preferred and preferred in df.columns and pd.api.types.is_numeric_dtype(df[preferred]):
            return preferred
        num_cols = df.select_dtypes(include="number").columns.tolist()
        return num_cols[0] if num_cols else None

    # ── SQL builders ─────────────────────────────────────────────────────────
    # Each method receives the same kwargs; returns a SQL string.

    def _sql_bar(self, base_table, x_col, y_col, agg_func, z_col, filters, joins, limit, offset):
        """Bar / Column: GROUP BY x, AGG(y) ORDER BY value DESC."""
        agg = _agg_expr(agg_func, y_col)
        where = _where(filters)
        sql = (
            f"SELECT {_safe_ident(x_col)}, {agg} AS value "
            f"FROM {_safe_ident(base_table)} {joins}{where} "
            f"GROUP BY {_safe_ident(x_col)} "
            f"ORDER BY value DESC"
        )
        return sql

    def _sql_line(self, base_table, x_col, y_col, agg_func, z_col, filters, joins, limit, offset):
        """Line / Area: GROUP BY x, AGG(y) ORDER BY x ASC (time-ordered)."""
        agg = _agg_expr(agg_func, y_col)
        where = _where(filters)
        sql = (
            f"SELECT {_safe_ident(x_col)}, {agg} AS value "
            f"FROM {_safe_ident(base_table)} {joins}{where} "
            f"GROUP BY {_safe_ident(x_col)} "
            f"ORDER BY {_safe_ident(x_col)} ASC"
        )
        return sql

    def _sql_area(self, **kw):
        return self._sql_line(**kw)

    def _sql_scatter(self, base_table, x_col, y_col, agg_func, z_col, filters, joins, limit, offset):
        """Scatter: raw (x, y) pairs — no aggregation."""
        where = _where(filters)
        sql = (
            f"SELECT {_safe_ident(x_col)}, {_safe_ident(y_col)} "
            f"FROM {_safe_ident(base_table)} {joins}{where} "
            f"ORDER BY {_safe_ident(x_col)}"
        )
        return sql

    def _sql_pie(self, base_table, x_col, y_col, agg_func, z_col, filters, joins, limit, offset):
        """Pie: top-N slices ordered by descending value."""
        agg = _agg_expr(agg_func, y_col)
        where = _where(filters)
        sql = (
            f"SELECT {_safe_ident(x_col)}, {agg} AS value "
            f"FROM {_safe_ident(base_table)} {joins}{where} "
            f"GROUP BY {_safe_ident(x_col)} "
            f"ORDER BY value DESC"
        )
        return sql

    def _sql_histogram(self, base_table, x_col, y_col, agg_func, z_col, filters, joins, limit, offset):
        """Histogram: raw numeric values for client-side binning."""
        target = x_col or y_col
        if not target:
            raise ValueError("histogram requer uma coluna numérica (x_col)")
        null_guard = f"{_safe_ident(target)} IS NOT NULL"
        all_filters = list(filters) + [null_guard]
        where = _where(all_filters)
        sql = (
            f"SELECT {_safe_ident(target)} "
            f"FROM {_safe_ident(base_table)} {joins}{where}"
        )
        return sql

    def _sql_heatmap(self, base_table, x_col, y_col, agg_func, z_col, filters, joins, limit, offset):
        """Heatmap: two category dimensions + AGG(metric) — produces the (x, y, value) matrix."""
        value_col = z_col or y_col
        agg = _agg_expr(agg_func, value_col)
        where = _where(filters)
        sql = (
            f"SELECT {_safe_ident(x_col)}, {_safe_ident(y_col)}, {agg} AS value "
            f"FROM {_safe_ident(base_table)} {joins}{where} "
            f"GROUP BY {_safe_ident(x_col)}, {_safe_ident(y_col)} "
            f"ORDER BY {_safe_ident(x_col)}, {_safe_ident(y_col)}"
        )
        return sql

    def _sql_treemap(self, base_table, x_col, y_col, agg_func, z_col, filters, joins, limit, offset):
        """TreeMap: one category + AGG(value) DESC."""
        agg = _agg_expr(agg_func, y_col)
        where = _where(filters)
        sql = (
            f"SELECT {_safe_ident(x_col)}, {agg} AS value "
            f"FROM {_safe_ident(base_table)} {joins}{where} "
            f"GROUP BY {_safe_ident(x_col)} "
            f"ORDER BY value DESC"
        )
        return sql

    def _sql_pareto(self, base_table, x_col, y_col, agg_func, z_col, filters, joins, limit, offset):
        """Pareto: like bar but cumulative % is added as a post-processing step in Python."""
        agg = _agg_expr(agg_func, y_col)
        where = _where(filters)
        sql = (
            f"SELECT {_safe_ident(x_col)}, {agg} AS value "
            f"FROM {_safe_ident(base_table)} {joins}{where} "
            f"GROUP BY {_safe_ident(x_col)} "
            f"ORDER BY value DESC"
        )
        return sql

    def _sql_kpi(self, base_table, x_col, y_col, agg_func, z_col, filters, joins, limit, offset):
        """KPI / Indicador: single aggregated scalar."""
        agg = _agg_expr(agg_func, y_col) if y_col else "COUNT(*)"
        where = _where(filters)
        return f"SELECT {agg} AS value FROM {_safe_ident(base_table)} {joins}{where}"

    def _sql_indicador(self, **kw):
        return self._sql_kpi(**kw)

    def _sql_pivottable(self, base_table, x_col, y_col, agg_func, z_col, filters, joins, limit, offset):
        """Pivot Table: two category dimensions + AGG(metric). Frontend pivots the result."""
        value_col = z_col or y_col
        agg = _agg_expr(agg_func, value_col)
        where = _where(filters)
        sql = (
            f"SELECT {_safe_ident(x_col)}, {_safe_ident(y_col)}, {agg} AS value "
            f"FROM {_safe_ident(base_table)} {joins}{where} "
            f"GROUP BY {_safe_ident(x_col)}, {_safe_ident(y_col)} "
            f"ORDER BY {_safe_ident(x_col)}, {_safe_ident(y_col)}"
        )
        return sql

    def _sql_radar(self, base_table, x_col, y_col, agg_func, z_col, filters, joins, limit, offset):
        """Radar: top N categories ordered by x (categorical axis)."""
        agg = _agg_expr(agg_func, y_col)
        where = _where(filters)
        sql = (
            f"SELECT {_safe_ident(x_col)}, {agg} AS value "
            f"FROM {_safe_ident(base_table)} {joins}{where} "
            f"GROUP BY {_safe_ident(x_col)} "
            f"ORDER BY {_safe_ident(x_col)} ASC"
        )
        return sql

    def _sql_map(self, base_table, x_col, y_col, agg_func, z_col, filters, joins, limit, offset):
        """Map: GROUP BY geographic column, AGG(metric) DESC."""
        agg = _agg_expr(agg_func, y_col)
        where = _where(filters)
        sql = (
            f"SELECT {_safe_ident(x_col)}, {agg} AS value "
            f"FROM {_safe_ident(base_table)} {joins}{where} "
            f"GROUP BY {_safe_ident(x_col)} "
            f"ORDER BY value DESC"
        )
        return sql

    def _sql_table(self, base_table, x_col, y_col, agg_func, z_col, filters, joins, limit, offset):
        """Table: raw rows with pagination — no aggregation."""
        where = _where(filters)
        sql = f"SELECT * FROM {_safe_ident(base_table)} {joins}{where}"
        return sql

    # ── Pandas builders ───────────────────────────────────────────────────────
    # Aggregated methods (bar, line, pie, heatmap, …) return the full GROUP BY
    # result — cardinality of the group key naturally bounds row count.
    # Raw-row methods (scatter, histogram) sample randomly up to _RAW_SAMPLE_ROWS
    # to stay memory-safe without positional bias.

    @staticmethod
    def _safe_sample(df: pd.DataFrame, n: int = _RAW_SAMPLE_ROWS) -> pd.DataFrame:
        """Return at most n rows using random sampling (avoids head-position bias)."""
        if len(df) <= n:
            return df.reset_index(drop=True)
        return df.sample(n=n, random_state=0).reset_index(drop=True)

    def _pandas_bar(self, df, x_col, y_col, agg_func, z_col, limit, offset):
        agg_col = self._best_numeric(df, y_col)
        if x_col not in df.columns or not agg_col:
            return df.copy()
        result = self._apply_agg(df, [x_col], agg_col, agg_func)
        return result.sort_values("value", ascending=False).reset_index(drop=True)

    def _pandas_line(self, df, x_col, y_col, agg_func, z_col, limit, offset):
        agg_col = self._best_numeric(df, y_col)
        if x_col not in df.columns or not agg_col:
            return df
        result = self._apply_agg(df, [x_col], agg_col, agg_func)
        return result.sort_values(x_col, ascending=True).reset_index(drop=True)

    def _pandas_area(self, **kw):
        return self._pandas_line(**kw)

    def _pandas_scatter(self, df, x_col, y_col, agg_func, z_col, limit, offset):
        cols = [c for c in [x_col, y_col] if c in df.columns]
        if len(cols) < 2:
            return self._safe_sample(df)
        return self._safe_sample(df[cols].dropna())

    def _pandas_pie(self, df, x_col, y_col, agg_func, z_col, limit, offset):
        agg_col = self._best_numeric(df, y_col)
        if x_col not in df.columns or not agg_col:
            return df.copy()
        result = self._apply_agg(df, [x_col], agg_col, agg_func)
        return result.sort_values("value", ascending=False).reset_index(drop=True)

    def _pandas_histogram(self, df, x_col, y_col, agg_func, z_col, limit, offset):
        agg_col = self._best_numeric(df, x_col) or self._best_numeric(df, y_col)
        if not agg_col:
            return self._safe_sample(df)
        col_name = x_col if x_col in df.columns else agg_col
        sampled = self._safe_sample(df[[agg_col]].dropna())
        return sampled.rename(columns={agg_col: col_name}).reset_index(drop=True)

    def _pandas_heatmap(self, df, x_col, y_col, agg_func, z_col, limit, offset):
        if z_col and z_col in df.columns and pd.api.types.is_numeric_dtype(df[z_col]):
            value_col = z_col
        else:
            candidates = [
                c for c in df.select_dtypes(include="number").columns
                if c not in (x_col, y_col)
            ]
            value_col = candidates[0] if candidates else None
        if x_col not in df.columns or y_col not in df.columns or not value_col:
            return df.copy()
        result = self._apply_agg(df, [x_col, y_col], value_col, agg_func)
        return result.sort_values([x_col, y_col]).reset_index(drop=True)

    def _pandas_treemap(self, df, x_col, y_col, agg_func, z_col, limit, offset):
        agg_col = self._best_numeric(df, y_col)
        if x_col not in df.columns or not agg_col:
            return df.copy()
        result = self._apply_agg(df, [x_col], agg_col, agg_func)
        return result.sort_values("value", ascending=False).reset_index(drop=True)

    def _pandas_pareto(self, df, x_col, y_col, agg_func, z_col, limit, offset):
        """Like bar but adds cumulative_pct column for the Pareto line."""
        agg_col = self._best_numeric(df, y_col)
        if x_col not in df.columns or not agg_col:
            return df.copy()
        result = self._apply_agg(df, [x_col], agg_col, agg_func)
        result = result.sort_values("value", ascending=False).reset_index(drop=True)
        total = result["value"].sum()
        result["cumulative_pct"] = (
            (result["value"].cumsum() / total * 100).round(2) if total > 0 else 0.0
        )
        return result

    def _pandas_kpi(self, df, x_col, y_col, agg_func, z_col, limit, offset):
        agg_col = self._best_numeric(df, y_col)
        if not agg_col:
            return pd.DataFrame({"value": [0]})
        af = (agg_func or "sum").lower()
        agg_map = {
            "sum": "sum", "avg": "mean", "mean": "mean",
            "count": "count", "min": "min", "max": "max",
        }
        fn = agg_map.get(af, "sum")
        value = df[agg_col].agg(fn)
        return pd.DataFrame({"value": [round(float(value), 4)]})

    def _pandas_indicador(self, **kw):
        return self._pandas_kpi(**kw)

    def _pandas_pivottable(self, df, x_col, y_col, agg_func, z_col, limit, offset):
        if z_col and z_col in df.columns and pd.api.types.is_numeric_dtype(df[z_col]):
            value_col = z_col
        else:
            candidates = [
                c for c in df.select_dtypes(include="number").columns
                if c not in (x_col, y_col)
            ]
            value_col = candidates[0] if candidates else None
        if x_col not in df.columns or y_col not in df.columns or not value_col:
            return df.copy()
        result = self._apply_agg(df, [x_col, y_col], value_col, agg_func)
        return result.sort_values([x_col, y_col]).reset_index(drop=True)

    def _pandas_radar(self, df, x_col, y_col, agg_func, z_col, limit, offset):
        agg_col = self._best_numeric(df, y_col)
        if x_col not in df.columns or not agg_col:
            return df.copy()
        result = self._apply_agg(df, [x_col], agg_col, agg_func)
        return result.sort_values(x_col).reset_index(drop=True)

    def _pandas_map(self, df, x_col, y_col, agg_func, z_col, limit, offset):
        return self._pandas_bar(
            df=df, x_col=x_col, y_col=y_col, agg_func=agg_func,
            z_col=z_col, limit=None, offset=offset,
        )

    def _pandas_table(self, df, x_col, y_col, agg_func, z_col, limit, offset):
        return self._safe_sample(df)


# ── Add Pareto cumulative_pct to a result DataFrame from SQL ─────────────────

def add_pareto_cumulative(df: pd.DataFrame) -> pd.DataFrame:
    """Add cumulative_pct column to a Pareto result that came from SQL."""
    if "value" not in df.columns:
        return df
    total = df["value"].sum()
    df = df.copy()
    df["cumulative_pct"] = (
        (df["value"].cumsum() / total * 100).round(2) if total > 0 else 0.0
    )
    return df
