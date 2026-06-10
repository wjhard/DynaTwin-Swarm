from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from swarm.domain.manufacturing.models import FactoryState, Machine, Material, Operation, Order, Worker


DATASET_DIR = Path(__file__).resolve().parents[2] / "datasets" / "public_jobshop"


def list_public_jobshop_datasets() -> List[Dict[str, Any]]:
    datasets: List[Dict[str, Any]] = []
    for path in sorted(DATASET_DIR.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        operation_count = sum(len(job["operations"]) for job in payload["jobs"])
        datasets.append(
            {
                "id": payload["id"],
                "name": payload["name"],
                "family": payload["family"],
                "source": payload["source"],
                "source_url": payload["source_url"],
                "description": payload["description"],
                "machine_count": payload["machine_count"],
                "job_count": payload["job_count"],
                "operation_count": operation_count,
                "best_known_makespan": payload.get("best_known_makespan"),
            }
        )
    return datasets


def load_public_jobshop_dataset(dataset_id: str) -> Dict[str, Any]:
    path = DATASET_DIR / f"{dataset_id}.json"
    if not path.exists():
        raise ValueError(f"Unknown public job-shop dataset: {dataset_id}")
    return json.loads(path.read_text(encoding="utf-8"))


def public_jobshop_state(dataset_id: str) -> FactoryState:
    payload = load_public_jobshop_dataset(dataset_id)
    machines = [
        Machine(
            id=f"M{machine_id}",
            name=f"Benchmark Machine {machine_id}",
            machine_type=f"machine_{machine_id}",
            capabilities=[f"machine_{machine_id}"],
            status="available",
            temperature_c=25,
        )
        for machine_id in range(1, payload["machine_count"] + 1)
    ]
    workers = [
        Worker(
            id=f"W{machine_id}",
            name=f"Operator {machine_id}",
            skills=[f"machine_{machine_id}"],
            assigned_machine_ids=[f"M{machine_id}"],
        )
        for machine_id in range(1, payload["machine_count"] + 1)
    ]
    orders: List[Order] = []
    due_minute = int(payload.get("best_known_makespan", 55) * 2)
    for job_index, job in enumerate(payload["jobs"], start=1):
        previous_operation_id = ""
        operations: List[Operation] = []
        for operation_index, operation in enumerate(job["operations"], start=1):
            machine_id = int(operation["machine"])
            operation_id = f"{payload['id'].upper()}-{job['id']}-O{operation_index}"
            operations.append(
                Operation(
                    id=operation_id,
                    order_id=f"{payload['id'].upper()}-{job['id']}",
                    name=f"{job['id']} Operation {operation_index}",
                    required_capability=f"machine_{machine_id}",
                    duration_minutes=int(operation["duration"]),
                    predecessors=[previous_operation_id] if previous_operation_id else [],
                    material_requirements={},
                    required_worker_skill=f"machine_{machine_id}",
                    safety_level=1,
                    switch_cost_minutes=0,
                )
            )
            previous_operation_id = operation_id
        priority = "high" if job_index <= 2 else "normal"
        orders.append(
            Order(
                id=f"{payload['id'].upper()}-{job['id']}",
                priority=priority,
                due_minute=due_minute + job_index * 5,
                operations=operations,
            )
        )
    return FactoryState(
        now_minute=0,
        machines=machines,
        orders=orders,
        materials=[Material(id="benchmark_capacity", name="Benchmark Capacity", quantity=999, unit="slots")],
        workers=workers,
        events=[{"type": "public_dataset_loaded", "dataset_id": payload["id"], "source": payload["source"]}],
        metadata={
            "scenario": f"public_dataset:{payload['id']}",
            "dataset_id": payload["id"],
            "dataset_name": payload["name"],
            "dataset_family": payload["family"],
            "source": payload["source"],
            "source_url": payload["source_url"],
            "best_known_makespan": payload.get("best_known_makespan"),
            "time_unit": "benchmark_processing_time",
        },
    )
