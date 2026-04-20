class QueryModel:
    def __init__(
        self,
        source_type,      # database | file
        tables,
        x_column,
        y_column,
        filters=None,
        chart_type="bar",  # chart-type drives SQL/Pandas shape
        z_column=None,    # third column (heatmap, pivottable)
    ):
        self.source_type = source_type
        self.tables = tables
        self.x_column = x_column
        self.y_column = y_column
        self.filters = filters or []
        self.chart_type = chart_type
        self.z_column = z_column

        self.group_by = []
        self.aggregations = []
