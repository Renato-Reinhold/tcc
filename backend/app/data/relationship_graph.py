import heapq
from collections import deque


class RelationshipGraph:

    def __init__(self):
        self.graph = {}

    def add_relation(self, from_table, to_table, from_col, to_col):
        self.graph.setdefault(from_table, []).append(
            (to_table, from_col, to_col)
        )
        self.graph.setdefault(to_table, []).append(
            (from_table, to_col, from_col)
        )


def find_join_path(
    graph,
    start,
    end,
    cost_estimator=None,
    filters=None,
    indexes=None,
    table_row_counts=None,
):
 
    if cost_estimator is not None:
        return _find_join_path_dijkstra(
            graph,
            start,
            end,
            cost_estimator,
            filters or [],
            indexes or [],
            table_row_counts,
        )

    queue = deque([(start, [])])
    visited = set()

    while queue:
        current, path = queue.popleft()

        if current == end:
            return path

        visited.add(current)

        for neighbor, from_col, to_col in graph.get(current, []):
            if neighbor not in visited:
                queue.append(
                    (neighbor, path + [(current, neighbor, from_col, to_col)])
                )

    return []


def _find_join_path_dijkstra(
    graph,
    start,
    end,
    cost_estimator,
    filters,
    indexes,
    table_row_counts,
):
    # heap entries: (custo_acumulado, tie_breaker, tabela_atual, caminho)
    counter = 0
    heap = [(0.0, counter, start, [])]
    visited: dict = {}

    while heap:
        cost, _, current, path = heapq.heappop(heap)

        if current in visited:
            continue
        visited[current] = cost

        if current == end:
            return path

        for neighbor, from_col, to_col in graph.get(current, []):
            if neighbor not in visited:
                edge_cost = cost_estimator.estimate_table_cost(
                    neighbor,
                    filters,
                    indexes,
                    table_row_counts,
                    join_distance=1,
                )
                counter += 1
                heapq.heappush(
                    heap,
                    (
                        cost + edge_cost,
                        counter,
                        neighbor,
                        path + [(current, neighbor, from_col, to_col)],
                    ),
                )

    return []
