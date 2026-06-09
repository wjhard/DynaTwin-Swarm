from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple


Edge = Tuple[str, str]


@dataclass(frozen=True)
class TopologyTemplate:
    name: str
    nodes: List[str]
    edges: List[Edge]
    parallel_groups: List[List[str]] = field(default_factory=list)

    def successors(self, node: str) -> List[str]:
        return [dst for src, dst in self.edges if src == node]

    def predecessors(self, node: str) -> List[str]:
        return [src for src, dst in self.edges if dst == node]

    def topological_order(self) -> List[str]:
        in_degree = {node: len(self.predecessors(node)) for node in self.nodes}
        queue = [node for node in self.nodes if in_degree[node] == 0]
        order: List[str] = []
        while queue:
            node = queue.pop(0)
            order.append(node)
            for successor in self.successors(node):
                in_degree[successor] -= 1
                if in_degree[successor] == 0:
                    queue.append(successor)
        if len(order) != len(self.nodes):
            raise ValueError(f"Topology {self.name} contains a cycle")
        return order


class TopologyRegistry:
    _templates: Dict[str, TopologyTemplate] = {}

    @classmethod
    def register(cls, template: TopologyTemplate) -> None:
        cls._templates[template.name] = template

    @classmethod
    def get(cls, name: str) -> TopologyTemplate:
        try:
            return cls._templates[name]
        except KeyError as exc:
            raise ValueError(f"Unknown topology: {name}") from exc

    @classmethod
    def names(cls) -> List[str]:
        return list(cls._templates)

    @classmethod
    def all(cls) -> Dict[str, TopologyTemplate]:
        return dict(cls._templates)


def _register_defaults() -> None:
    TopologyRegistry.register(
        TopologyTemplate(
            name="serial_chain",
            nodes=["TaskRouter", "Monitor", "Schedule", "Constraint", "Report"],
            edges=[
                ("TaskRouter", "Monitor"),
                ("Monitor", "Schedule"),
                ("Schedule", "Constraint"),
                ("Constraint", "Report"),
            ],
        )
    )
    TopologyRegistry.register(
        TopologyTemplate(
            name="parallel_fusion",
            nodes=["TaskRouter", "Monitor", "Diagnosis", "Order", "Resource", "Schedule", "Constraint", "Report"],
            edges=[
                ("TaskRouter", "Monitor"),
                ("Monitor", "Diagnosis"),
                ("Monitor", "Order"),
                ("Monitor", "Resource"),
                ("Diagnosis", "Schedule"),
                ("Order", "Schedule"),
                ("Resource", "Schedule"),
                ("Schedule", "Constraint"),
                ("Constraint", "Report"),
            ],
            parallel_groups=[["Diagnosis", "Order", "Resource"]],
        )
    )
    TopologyRegistry.register(
        TopologyTemplate(
            name="supervisor_tree",
            nodes=["TaskRouter", "Supervisor", "Diagnosis", "Order", "Resource", "Risk", "Schedule", "Constraint", "Critic", "Report"],
            edges=[
                ("TaskRouter", "Supervisor"),
                ("Supervisor", "Diagnosis"),
                ("Supervisor", "Order"),
                ("Supervisor", "Resource"),
                ("Supervisor", "Risk"),
                ("Diagnosis", "Schedule"),
                ("Order", "Schedule"),
                ("Resource", "Schedule"),
                ("Risk", "Schedule"),
                ("Schedule", "Constraint"),
                ("Constraint", "Critic"),
                ("Critic", "Report"),
            ],
            parallel_groups=[["Diagnosis", "Order", "Resource", "Risk"]],
        )
    )
    TopologyRegistry.register(
        TopologyTemplate(
            name="high_risk_review",
            nodes=["TaskRouter", "Monitor", "Diagnosis", "Order", "Resource", "Schedule", "Constraint", "Risk", "Critic", "FinalDecision", "Report"],
            edges=[
                ("TaskRouter", "Monitor"),
                ("Monitor", "Diagnosis"),
                ("Monitor", "Order"),
                ("Monitor", "Resource"),
                ("Diagnosis", "Schedule"),
                ("Order", "Schedule"),
                ("Resource", "Schedule"),
                ("Schedule", "Constraint"),
                ("Constraint", "Risk"),
                ("Risk", "Critic"),
                ("Critic", "FinalDecision"),
                ("FinalDecision", "Report"),
            ],
            parallel_groups=[["Diagnosis", "Order", "Resource"]],
        )
    )


_register_defaults()
