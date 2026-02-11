def choose_best_base_table(tables, filters, indexes):
    costs = {}

    for table in tables:
        cost = 0
        for f in filters:
            if f.startswith(table):
                col = f.split(".")[1]
                if any(i.table == table and i.column == col for i in indexes):
                    cost += 1
                else:
                    cost += 10

        costs[table] = cost

    return min(costs, key=costs.get)
