import pandas as pd
from .aggregation_inferer import AggregationInferer
from .base_table_selector import choose_best_base_table
from .cost_estimator import CostEstimator
from .sql_generator import SQLGenerator
from .pandas_executor import PandasExecutor

class DataQueryService:

    def __init__(self):
        self._cost_estimator = CostEstimator()

    def execute(
        self,
        query,
        column_metadata,
        index_metadata,
        relationship_graph,
        data_source,
        table_row_counts=None,
    ):
        # 1. inferir agregações
        group_by, aggregations = AggregationInferer().infer(
            column_metadata[query.x_column],
            column_metadata[query.y_column]
        )

        query.group_by = group_by
        query.aggregations = aggregations

        # 2. escolher tabela base
        base_table = choose_best_base_table(
            query.tables,
            query.filters,
            index_metadata
        )

        # 3. executar
        if query.source_type == "database":
            sql = SQLGenerator().generate(
                query,
                relationship_graph,
                base_table,
                cost_estimator=self._cost_estimator,
                index_metadata=index_metadata,
                table_row_counts=table_row_counts,
            )
            return data_source.execute_sql(sql)

        if query.source_type == "file":
            return PandasExecutor().execute(data_source, query)
