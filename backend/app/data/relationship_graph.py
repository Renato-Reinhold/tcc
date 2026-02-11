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


def find_join_path(graph, start, end):
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
