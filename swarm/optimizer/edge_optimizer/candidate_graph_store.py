from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List


@dataclass
class CandidateGraph:
    graph_id: str
    nodes: List[str]
    edges: List[List[str]]
    score: float
    task_type: str
    metadata: Dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        return {
            "graph_id": self.graph_id,
            "nodes": self.nodes,
            "edges": self.edges,
            "score": self.score,
            "task_type": self.task_type,
            "metadata": self.metadata,
        }


class CandidateGraphStore:
    def __init__(self, top_k: int = 5) -> None:
        self.top_k = top_k
        self.graphs: List[CandidateGraph] = []

    def add(self, graph: CandidateGraph) -> None:
        self.graphs.append(graph)
        self.graphs.sort(key=lambda item: item.score, reverse=True)
        self.graphs = self.graphs[: self.top_k]

    def top(self) -> List[CandidateGraph]:
        return list(self.graphs)

    def save(self, path: str) -> None:
        output = Path(path)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps([graph.to_dict() for graph in self.graphs], indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path: str, top_k: int = 5) -> "CandidateGraphStore":
        store = cls(top_k=top_k)
        file_path = Path(path)
        if not file_path.exists():
            return store
        for item in json.loads(file_path.read_text(encoding="utf-8")):
            store.add(CandidateGraph(**item))
        return store
