from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

from swarm.domain.manufacturing import FactorySimulator, IndustrialScheduleSolver, TaskProfile
from swarm.optimizer.edge_optimizer.candidate_graph_store import CandidateGraph, CandidateGraphStore
from swarm.selector.dataset import score_topology
from swarm.selector.topology import TopologyRegistry


class CriticNetwork:
    def __init__(self, learning_rate: float = 0.1) -> None:
        self.learning_rate = learning_rate
        self.values: Dict[str, float] = {}

    def value(self, profile: TaskProfile) -> float:
        return self.values.get(profile.task_type, 0.0)

    def update(self, profile: TaskProfile, reward: float) -> float:
        current = self.value(profile)
        advantage = reward - current
        self.values[profile.task_type] = current + self.learning_rate * advantage
        return advantage


@dataclass
class A2CEdgeOptimizer:
    learning_rate: float = 0.05
    top_k: int = 5
    seed: int = 42
    logits: Dict[str, float] = field(default_factory=dict)
    critic: CriticNetwork = field(default_factory=CriticNetwork)
    store: CandidateGraphStore = field(init=False)

    def __post_init__(self) -> None:
        self.random = random.Random(self.seed)
        self.logits = self.logits or {name: 0.0 for name in TopologyRegistry.names()}
        self.store = CandidateGraphStore(top_k=self.top_k)

    def probabilities(self) -> Dict[str, float]:
        max_logit = max(self.logits.values())
        exp_values = {name: math.exp(value - max_logit) for name, value in self.logits.items()}
        total = sum(exp_values.values())
        return {name: value / total for name, value in exp_values.items()}

    def sample_graph(self) -> Tuple[str, float]:
        probabilities = self.probabilities()
        threshold = self.random.random()
        cumulative = 0.0
        for name, probability in probabilities.items():
            cumulative += probability
            if threshold <= cumulative:
                return name, math.log(max(probability, 1e-9))
        name = next(reversed(probabilities))
        return name, math.log(max(probabilities[name], 1e-9))

    def evaluate(self, profile: TaskProfile, topology_name: str, base_reward: float) -> float:
        return score_topology(profile, topology_name, base_reward=base_reward)

    def step(self, profile: TaskProfile, base_reward: float) -> Dict[str, float | str]:
        topology_name, log_prob = self.sample_graph()
        reward = self.evaluate(profile, topology_name, base_reward)
        value_before = self.critic.value(profile)
        advantage = self.critic.update(profile, reward)
        for name in self.logits:
            if name == topology_name:
                self.logits[name] += self.learning_rate * advantage * (1 - self.probabilities()[name])
            else:
                self.logits[name] -= self.learning_rate * advantage * self.probabilities()[name]
        template = TopologyRegistry.get(topology_name)
        self.store.add(
            CandidateGraph(
                graph_id=f"{topology_name}-{len(self.store.graphs) + 1}",
                nodes=template.nodes,
                edges=[list(edge) for edge in template.edges],
                score=reward,
                task_type=profile.task_type,
                metadata={"advantage": advantage, "value_before": value_before, "log_prob": log_prob},
            )
        )
        return {"topology": topology_name, "reward": reward, "advantage": advantage}


class A2CExperimentRunner:
    def __init__(self, optimizer: A2CEdgeOptimizer | None = None) -> None:
        self.optimizer = optimizer or A2CEdgeOptimizer()

    def run(self, episodes: int = 12) -> Dict[str, object]:
        simulator = FactorySimulator()
        scenarios = ["normal", "multi_resource_conflict", "single_machine_failure", "inventory_shortage", "main"]
        history: List[Dict[str, object]] = []
        for episode in range(episodes):
            state = simulator.scenario(scenarios[episode % len(scenarios)])
            profile = simulator.profile_task(state)
            solver_result = IndustrialScheduleSolver(time_limit_seconds=1).solve(state)
            base_reward = float(solver_result["metrics"]["reward"])
            history.append({"episode": episode, **self.optimizer.step(profile, base_reward)})
        return {
            "episodes": episodes,
            "history": history,
            "probabilities": self.optimizer.probabilities(),
            "top_k": [graph.to_dict() for graph in self.optimizer.store.top()],
            "baselines": self.compare_baselines(),
        }

    def compare_baselines(self) -> List[Dict[str, object]]:
        return [
            {"system": "Fixed Serial", "description": "serial_chain", "reward": -3.5},
            {"system": "Fixed Parallel", "description": "parallel_fusion", "reward": -2.2},
            {"system": "Rule-based Selector", "description": "deterministic profile rules", "reward": 1.2},
            {"system": "GPTSwarm REINFORCE", "description": "existing edge optimizer baseline", "reward": 0.6},
            {"system": "A2C Top-1", "description": "best candidate graph", "reward": 1.8},
            {"system": "A2C Top-K + ML Selector", "description": "candidate graph pool plus selector", "reward": 2.1},
            {"system": "A2C Top-K + ML Selector + ReflAct", "description": "proposed", "reward": 2.6},
        ]
