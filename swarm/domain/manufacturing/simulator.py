from __future__ import annotations

import argparse
import json
import random
from pathlib import Path
from typing import Callable, Dict, Iterable, Optional

from swarm.domain.manufacturing.models import (
    FactoryState,
    Machine,
    MachineAlert,
    Material,
    Operation,
    Order,
    TaskProfile,
    Worker,
)


SHIFT_START_MINUTE = 0
TIME_1530 = 7 * 60 + 30
TIME_1600 = 8 * 60
TIME_1800 = 10 * 60
TIME_NEXT_DAY = 24 * 60


class FactorySimulator:
    def __init__(self, seed: int = 42) -> None:
        self.seed = seed
        self.random = random.Random(seed)
        self._events: Dict[str, Callable[[FactoryState], FactoryState]] = {
            "m3_overheat": self.trigger_m3_overheat,
            "urgent_order_o4": self.create_urgent_order_o4,
            "inventory_shortage": self.trigger_inventory_shortage,
            "worker_skill_mismatch": self.trigger_worker_skill_mismatch,
        }

    def base_state(self) -> FactoryState:
        machines = [
            Machine(id="M1", name="Cutter 1", machine_type="cutting", capabilities=["cutting"], status="busy", current_order_id="O1"),
            Machine(id="M2", name="Cutter 2", machine_type="cutting", capabilities=["cutting"], status="available"),
            Machine(id="M3", name="Precision Mill 1", machine_type="precision", capabilities=["precision"], status="busy", current_order_id="O2", temperature_c=72),
            Machine(id="M4", name="Precision Mill 2", machine_type="precision", capabilities=["precision"], status="available", efficiency=0.72),
        ]
        orders = [
            self._order("O1", "normal", TIME_1800, [("O1-CUT", "cutting", 60), ("O1-MILL", "precision", 90, ["O1-CUT"])]),
            self._order("O2", "high", TIME_1600, [("O2-CUT", "cutting", 45), ("O2-MILL", "precision", 100, ["O2-CUT"])]),
            self._order("O3", "normal", TIME_NEXT_DAY, [("O3-CUT", "cutting", 50), ("O3-MILL", "precision", 80, ["O3-CUT"])]),
        ]
        materials = [
            Material(id="steel", name="Steel Blank", quantity=12),
            Material(id="coolant", name="Coolant", quantity=4),
            Material(id="fixture", name="Precision Fixture", quantity=2),
        ]
        workers = [
            Worker(id="W1", name="Li", skills=["cutting", "inspection"]),
            Worker(id="W2", name="Chen", skills=["precision", "inspection"]),
            Worker(id="W3", name="Wang", skills=["cutting", "precision"]),
        ]
        return FactoryState(
            now_minute=SHIFT_START_MINUTE,
            machines=machines,
            orders=orders,
            materials=materials,
            workers=workers,
            events=[{"type": "state_created", "seed": self.seed}],
            metadata={"scenario": "base", "time_unit": "minutes_since_08_00"},
        )

    def _order(self, order_id: str, priority: str, due_minute: int, steps: Iterable[tuple]) -> Order:
        operations = []
        for step in steps:
            op_id, capability, duration = step[:3]
            predecessors = list(step[3]) if len(step) > 3 else []
            material = {"steel": 2, "coolant": 1} if capability == "precision" else {"steel": 1}
            operations.append(
                Operation(
                    id=op_id,
                    order_id=order_id,
                    name=f"{capability.title()} {order_id}",
                    required_capability=capability,
                    duration_minutes=duration,
                    predecessors=predecessors,
                    material_requirements=material,
                    required_worker_skill=capability,
                    safety_level=2 if capability == "precision" else 1,
                    switch_cost_minutes=5 if capability == "precision" else 2,
                )
            )
        return Order(id=order_id, priority=priority, due_minute=due_minute, operations=operations)

    def scenario(self, name: str) -> FactoryState:
        state = self.base_state()
        if name == "normal":
            state.metadata["scenario"] = "normal"
            return state
        if name == "multi_resource_conflict":
            state = self.create_urgent_order_o4(state)
            state = self.trigger_inventory_shortage(state)
        elif name == "single_machine_failure":
            state = self.trigger_m3_overheat(state)
        elif name == "inventory_shortage":
            state = self.trigger_inventory_shortage(state)
        elif name == "worker_skill_mismatch":
            state = self.trigger_worker_skill_mismatch(state)
        elif name in {"main", "composite_incident"}:
            state = self.final_abnormal_state()
        else:
            raise ValueError(f"Unknown scenario: {name}")
        state.metadata["scenario"] = name
        return state

    def step(self, state: Optional[FactoryState] = None, event_name: Optional[str] = None) -> FactoryState:
        state = state.model_copy(deep=True) if state else self.base_state()
        if event_name is None:
            event_name = self.random.choice(list(self._events.keys()))
        if event_name not in self._events:
            raise ValueError(f"Unknown event: {event_name}")
        state.now_minute += 15
        return self._events[event_name](state)

    def trigger_m3_overheat(self, state: FactoryState) -> FactoryState:
        state = state.model_copy(deep=True)
        machine = state.machine("M3")
        if machine:
            machine.temperature_c = 96
            machine.status = "failed"
            machine.current_order_id = None
        state.alerts.append(
            MachineAlert(
                machine_id="M3",
                alert_type="temperature",
                severity="critical",
                message="M3 temperature exceeded threshold; immediate stop required.",
                minute=state.now_minute,
                requires_stop=True,
            )
        )
        state.events.append({"type": "machine_alert", "machine_id": "M3", "severity": "critical"})
        return state

    def create_urgent_order_o4(self, state: FactoryState) -> FactoryState:
        state = state.model_copy(deep=True)
        if any(order.id == "O4" for order in state.orders):
            return state
        state.orders.append(
            self._order("O4", "urgent", TIME_1530, [("O4-CUT", "cutting", 35), ("O4-MILL", "precision", 70, ["O4-CUT"])])
        )
        state.events.append({"type": "order_created", "order_id": "O4", "priority": "urgent"})
        return state

    def trigger_inventory_shortage(self, state: FactoryState) -> FactoryState:
        state = state.model_copy(deep=True)
        steel = state.material("steel")
        if steel:
            steel.quantity = 5
        state.events.append({"type": "inventory_shortage", "material_id": "steel", "quantity": 5})
        return state

    def trigger_worker_skill_mismatch(self, state: FactoryState) -> FactoryState:
        state = state.model_copy(deep=True)
        for worker in state.workers:
            if "precision" in worker.skills:
                worker.skills = [skill for skill in worker.skills if skill != "precision"]
        state.events.append({"type": "worker_skill_mismatch", "skill": "precision"})
        return state

    def final_abnormal_state(self) -> FactoryState:
        state = self.base_state()
        for event in ("m3_overheat", "urgent_order_o4", "inventory_shortage"):
            state = self.step(state, event)
        state.metadata["scenario"] = "main"
        return state

    def profile_task(self, state: FactoryState) -> TaskProfile:
        urgent_count = sum(1 for order in state.orders if order.priority == "urgent")
        failed_capabilities = {
            capability
            for machine in state.machines
            if machine.status == "failed"
            for capability in machine.capabilities
        }
        resource_conflicts = 0
        if urgent_count and any("precision" in operation.required_capability for order in state.orders for operation in order.operations):
            resource_conflicts += 1
        inventory_shortage_count = self._inventory_shortage_count(state)
        worker_conflict_count = self._worker_conflict_count(state)
        critical_alerts = [alert for alert in state.alerts if alert.severity in {"high", "critical"}]
        risk = "critical" if critical_alerts else "high" if inventory_shortage_count else "medium" if urgent_count else "low"
        task_type = "normal_scheduling"
        if critical_alerts and urgent_count:
            task_type = "high_risk_composite_incident"
        elif critical_alerts:
            task_type = "machine_failure"
        elif inventory_shortage_count:
            task_type = "inventory_shortage"
        elif resource_conflicts:
            task_type = "multi_resource_conflict"
        return TaskProfile(
            task_type=task_type,
            risk_level=risk,
            machine_alert_count=len(state.alerts),
            urgent_order_count=urgent_count,
            resource_conflict_count=resource_conflicts + len(failed_capabilities),
            inventory_shortage_count=inventory_shortage_count,
            worker_conflict_count=worker_conflict_count,
            requires_parallel_analysis=resource_conflicts > 0 or inventory_shortage_count > 0,
            requires_critic_review=risk in {"high", "critical"},
        )

    def _inventory_shortage_count(self, state: FactoryState) -> int:
        required: Dict[str, int] = {}
        for order in state.orders:
            for operation in order.operations:
                for material_id, amount in operation.material_requirements.items():
                    required[material_id] = required.get(material_id, 0) + amount
        return sum(1 for material_id, amount in required.items() if (state.material(material_id).available if state.material(material_id) else 0) < amount)

    def _worker_conflict_count(self, state: FactoryState) -> int:
        required_skills = {operation.required_worker_skill for order in state.orders for operation in order.operations if operation.required_worker_skill}
        return sum(1 for skill in required_skills if state.worker_with_skill(skill) is None)

    @staticmethod
    def export_json(state: FactoryState, path: str) -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(state.model_dump_json(indent=2), encoding="utf-8")

    @staticmethod
    def import_json(path: str) -> FactoryState:
        return FactoryState.model_validate_json(Path(path).read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the DynaTwin factory simulator.")
    parser.add_argument("--scenario", default="main", choices=["normal", "main", "composite_incident", "multi_resource_conflict", "single_machine_failure", "inventory_shortage", "worker_skill_mismatch"])
    parser.add_argument("--event", default=None)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    simulator = FactorySimulator()
    state = simulator.scenario(args.scenario)
    if args.event:
        state = simulator.step(state, args.event)
    payload = state.model_dump(mode="json")
    if args.output:
        simulator.export_json(state, args.output)
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
