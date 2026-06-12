from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from swarm.domain.manufacturing.models import FactoryState, Machine, Material, Operation, Order, Worker


DATASET_DIR = Path(__file__).resolve().parents[2] / "datasets" / "public_jobshop"
SCHEDULEOPT_RAW_BASE = "https://raw.githubusercontent.com/ScheduleOpt/benchmarks/main/jobshop/instances/json"


def _operation_count(payload: Dict[str, Any]) -> int:
    if isinstance(payload.get("jobs"), list):
        return sum(len(job["operations"]) for job in payload["jobs"])
    if isinstance(payload.get("data"), list):
        return len(payload["data"])
    return 0


def _normalise_payload(payload: Dict[str, Any], file_stem: str) -> Dict[str, Any]:
    if isinstance(payload.get("jobs"), list):
        return {
            "id": payload["id"],
            "name": payload["name"],
            "family": payload["family"],
            "source": payload["source"],
            "source_url": payload["source_url"],
            "description": payload["description"],
            "machine_count": payload["machine_count"],
            "job_count": payload["job_count"],
            "best_known_makespan": payload.get("best_known_makespan"),
            "jobs": payload["jobs"],
        }

    if isinstance(payload.get("data"), list):
        dataset_id = str(payload.get("instance", file_stem))
        family_long = str(payload.get("family_long", payload.get("family", "Job Shop Benchmark")))
        job_count = int(payload["jobs"])
        jobs: List[Dict[str, Any]] = []
        for job_index in range(job_count):
            operations = [
                {
                    "machine": int(item["machine"]) + 1,
                    "duration": int(item["duration"]),
                }
                for item in sorted(payload["data"], key=lambda item: item["operation"])
                if int(item["job"]) == job_index
            ]
            jobs.append({"id": f"J{job_index + 1}", "operations": operations})
        return {
            "id": dataset_id,
            "name": f"{family_long} {dataset_id.upper()}",
            "family": f"{family_long} public benchmark",
            "source": "ScheduleOpt benchmark mirror of classic public Job Shop instances",
            "source_url": f"{SCHEDULEOPT_RAW_BASE}/{dataset_id}.json",
            "description": (
                f"{job_count}-job, {int(payload['machines'])}-machine public Job Shop Scheduling benchmark "
                "for medium and large factory scheduling validation."
            ),
            "machine_count": int(payload["machines"]),
            "job_count": job_count,
            "best_known_makespan": payload.get("best_known_makespan"),
            "jobs": jobs,
        }

    raise ValueError(f"Unsupported public job-shop dataset format: {file_stem}")


def list_public_jobshop_datasets() -> List[Dict[str, Any]]:
    datasets: List[Dict[str, Any]] = []
    for path in sorted(DATASET_DIR.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        dataset = _normalise_payload(payload, path.stem)
        datasets.append(
            {
                "id": dataset["id"],
                "name": dataset["name"],
                "family": dataset["family"],
                "source": dataset["source"],
                "source_url": dataset["source_url"],
                "description": dataset["description"],
                "machine_count": dataset["machine_count"],
                "job_count": dataset["job_count"],
                "operation_count": _operation_count(dataset),
                "best_known_makespan": dataset.get("best_known_makespan"),
            }
        )
    return datasets


def load_public_jobshop_dataset(dataset_id: str) -> Dict[str, Any]:
    path = DATASET_DIR / f"{dataset_id}.json"
    if not path.exists():
        raise ValueError(f"Unknown public job-shop dataset: {dataset_id}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    return _normalise_payload(payload, path.stem)


def _estimated_due_minute(payload: Dict[str, Any]) -> int:
    best_known = payload.get("best_known_makespan")
    if isinstance(best_known, (int, float)):
        return int(best_known * 2)

    machine_load = {machine_id: 0 for machine_id in range(1, payload["machine_count"] + 1)}
    job_loads = []
    for job in payload["jobs"]:
        job_load = 0
        for operation in job["operations"]:
            duration = int(operation["duration"])
            job_load += duration
            machine_load[int(operation["machine"])] += duration
        job_loads.append(job_load)
    lower_bound = max(max(job_loads or [0]), max(machine_load.values() or [0]))
    return max(24 * 60, int(lower_bound * 1.6))


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
    due_minute = _estimated_due_minute(payload)
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
