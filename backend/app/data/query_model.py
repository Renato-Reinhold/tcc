class QueryModel:
    def __init__(
        self,
        source_type,      # database | file
        tables,
        x_column,
        y_column,
        filters=None
    ):
        self.source_type = source_type
        self.tables = tables
        self.x_column = x_column
        self.y_column = y_column
        self.filters = filters or []

        self.group_by = []
        self.aggregations = []
