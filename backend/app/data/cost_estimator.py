import math
from collections import defaultdict


class CostEstimator:

    FULL_SCAN_BASE = 100
    UNINDEXED_FILTER_COST = 10
    INDEXED_FILTER_COST = 1
    UNIQUE_INDEX_FILTER_COST = 0.5
    COMPOUND_UNINDEXED_PENALTY = 5
    JOIN_HOP_COST = 20
    ROW_COUNT_LOG_FACTOR = 10
    AVG_EXEC_TIME_WEIGHT = 0.1

    def __init__(self):
        self._exec_history: dict = defaultdict(list)

    def record_execution_time(self, table: str, elapsed_ms: float) -> None:
        self._exec_history[table].append(elapsed_ms)

    def average_execution_time(self, table: str):
        history = self._exec_history.get(table)
        return sum(history) / len(history) if history else None

    def estimate_table_cost(
        self,
        table,
        filters,
        indexes,
        table_row_counts=None,
        join_distance=0,
    ):

        cost = self.FULL_SCAN_BASE

        # Escala pelo tamanho da tabela (log para evitar dominância numérica)
        if table_row_counts and table in table_row_counts:
            row_count = max(table_row_counts[table], 1)
            cost += math.log10(row_count) * self.ROW_COUNT_LOG_FACTOR

        # Custo dos filtros relevantes a esta tabela
        relevant_filters = [f for f in filters if f.startswith(table + ".")]
        unindexed_count = 0

        for f in relevant_filters:
            col = f.split(".")[1]
            matching_index = next(
                (i for i in indexes if i.table == table and i.column == col),
                None,
            )

            if matching_index is None:
                cost += self.UNINDEXED_FILTER_COST
                unindexed_count += 1
            elif getattr(matching_index, "unique", False):
                cost += self.UNIQUE_INDEX_FILTER_COST
            else:
                cost += self.INDEXED_FILTER_COST

        # Penalidade composta: múltiplos filtros sem índice forçam reavaliação
        if unindexed_count > 1:
            cost += (unindexed_count - 1) * self.COMPOUND_UNINDEXED_PENALTY

        # Custo de joins necessários para chegar à tabela
        cost += join_distance * self.JOIN_HOP_COST


        avg_ms = self.average_execution_time(table)
        if avg_ms is not None:
            cost += avg_ms * self.AVG_EXEC_TIME_WEIGHT

        return cost
