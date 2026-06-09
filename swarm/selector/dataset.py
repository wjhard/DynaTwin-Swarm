from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Iterable, List

from swarm.domain.manufacturing import FactorySimulator, IndustrialScheduleSolver, TaskProfile
from swarm.selector.topology import TopologyRegistry


FEATURE_NAMES = [
    "task_type",
    "risk_level",
    "machine_alert_count",
    "urgent_order_count",
    "resource_conflict_count",
    "inventory_shortage_count",
    "worker_conflict_count",
    "requires_parallel_analysis",
    "requires_critic_review",
]


def score_topology(profile: TaskProfile, topology_name: str, base_reward: float = 0.0) -> float:
    score = base_reward
    score -= len(TopologyRegistry.get(topology_name).nodes) * 0.05
    if profile.task_type == "normal_scheduling" and topology_name == "serial_chain":
        score += 5
    if profile.resource_conflict_count and topology_name == "parallel_fusion":
        score += 5
    if profile.task_type == "complex_composite_incident" and topology_name == "supervisor_tree":
        score += 5
    if profile.machine_alert_count and profile.risk_level in {"high", "critical"} and topology_name == "high_risk_review":
        score += 6
    if profile.requires_critic_review and topology_name in {"high_risk_review", "supervisor_tree"}:
        score += 1.5
    return score


def profile_to_row(profile: TaskProfile, rewards: Dict[str, float]) -> Dict[str, object]:
    best_topology = max(rewards, key=rewards.get)
    return {
        "features": {name: getattr(profile, name) for name in FEATURE_NAMES},
        "rewards": rewards,
        "label": best_topology,
    }


def generate_selector_rows(seeds: Iterable[int] = range(5)) -> List[Dict[str, object]]:
    scenarios = [
        "normal",
        "multi_resource_conflict",
        "single_machine_failure",
        "inventory_shortage",
        "worker_skill_mismatch",
        "main",
    ]
    rows: List[Dict[str, object]] = []
    for seed in seeds:
        simulator = FactorySimulator(seed=seed)
        for scenario in scenarios:
            state = simulator.scenario(scenario)
            profile = simulator.profile_task(state)
            solver_result = IndustrialScheduleSolver(time_limit_seconds=1).solve(state)
            base_reward = float(solver_result["metrics"]["reward"])
            rewards = {
                topology_name: score_topology(profile, topology_name, base_reward)
                for topology_name in TopologyRegistry.names()
            }
            rows.append(profile_to_row(profile, rewards))
    return rows


def write_jsonl(rows: List[Dict[str, object]], path: str) -> None:
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(json.dumps(row) for row in rows) + "\n", encoding="utf-8")


def read_jsonl(path: str) -> List[Dict[str, object]]:
    return [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]
