class CostEstimator:

    def estimate_table_cost(self, table, filters, indexes):
        cost = 0

        for f in filters:
            if f.startswith(table):
                col = f.split(".")[1]
                if any(i.table == table and i.column == col for i in indexes):
                    cost += 1
                else:
                    cost += 10

        return cost
