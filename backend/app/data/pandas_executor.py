class PandasExecutor:

    def execute(self, dataframes, query):
        df = dataframes[query.tables[0]]

        for agg in query.aggregations:
            group_cols = [c.split(".")[-1] for c in query.group_by]
            value_col = agg["field"].split(".")[-1]

            df = (
                df.groupby(group_cols)[value_col]
                .sum()
                .reset_index()
            )

        return df
