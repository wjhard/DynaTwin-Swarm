from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Optional, Tuple

try:
    from ortools.sat.python import cp_model
except ImportError:  # pragma: no cover
    cp_model = None

from swarm.domain.manufacturing.models import (
    ConstraintViolation,
    FactoryState,
    Machine,
    Operation,
    Order,
    ScheduleItem,
    SchedulePlan,
    Worker,
)


PRIORITY_WEIGHT = {"urgent": 5, "high": 3, "normal": 1}


class ConstraintValidator:
    def validate(self, state: FactoryState, plan: SchedulePlan) -> List[ConstraintViolation]:
        violations: List[ConstraintViolation] = []
        violations.extend(self._machine_overlap(plan))
        violations.extend(self._failed_machine(state, plan))
        violations.extend(self._precedence(state, plan))
        violations.extend(self._capability(state, plan))
        violations.extend(self._inventory(state, plan))
        violations.extend(self._worker_skill(state, plan))
        violations.extend(self._due_dates(state, plan))
        violations.extend(self._safety(state, plan))
        return violations

    def _machine_overlap(self, plan: SchedulePlan) -> List[ConstraintViolation]:
        violations = []
        by_machine: Dict[str, List[ScheduleItem]] = defaultdict(list)
        for item in plan.items:
            by_machine[item.machine_id].append(item)
        for machine_id, items in by_machine.items():
            ordered = sorted(items, key=lambda item: item.start_minute)
            for left, right in zip(ordered, ordered[1:]):
                if left.end_minute > right.start_minute:
                    violations.append(
                        ConstraintViolation(
                            constraint="machine_no_overlap",
                            severity="critical",
                            message=f"{machine_id} has overlapping operations {left.operation_id} and {right.operation_id}",
                            related_ids=[machine_id, left.operation_id, right.operation_id],
                        )
                    )
        return violations

    def _failed_machine(self, state: FactoryState, plan: SchedulePlan) -> List[ConstraintViolation]:
        failed = {machine.id for machine in state.machines if machine.status == "failed"}
        return [
            ConstraintViolation(
                constraint="failed_machine_exclusion",
                severity="critical",
                message=f"{item.operation_id} is scheduled on failed machine {item.machine_id}",
                related_ids=[item.operation_id, item.machine_id],
            )
            for item in plan.items
            if item.machine_id in failed
        ]

    def _precedence(self, state: FactoryState, plan: SchedulePlan) -> List[ConstraintViolation]:
        by_operation = {item.operation_id: item for item in plan.items}
        operations = {operation.id: operation for order in state.orders for operation in order.operations}
        violations = []
        for item in plan.items:
            operation = operations[item.operation_id]
            for predecessor_id in operation.predecessors:
                predecessor_item = by_operation.get(predecessor_id)
                if predecessor_item and predecessor_item.end_minute > item.start_minute:
                    violations.append(
                        ConstraintViolation(
                            constraint="operation_precedence",
                            severity="high",
                            message=f"{item.operation_id} starts before predecessor {predecessor_id} finishes",
                            related_ids=[item.operation_id, predecessor_id],
                        )
                    )
        return violations

    def _capability(self, state: FactoryState, plan: SchedulePlan) -> List[ConstraintViolation]:
        machines = {machine.id: machine for machine in state.machines}
        operations = {operation.id: operation for order in state.orders for operation in order.operations}
        violations = []
        for item in plan.items:
            operation = operations[item.operation_id]
            machine = machines[item.machine_id]
            if operation.required_capability not in machine.capabilities:
                violations.append(
                    ConstraintViolation(
                        constraint="machine_capability",
                        severity="high",
                        message=f"{machine.id} cannot perform {operation.required_capability}",
                        related_ids=[machine.id, operation.id],
                    )
                )
        return violations

    def _inventory(self, state: FactoryState, plan: SchedulePlan) -> List[ConstraintViolation]:
        operations = {operation.id: operation for order in state.orders for operation in order.operations}
        required: Dict[str, int] = defaultdict(int)
        for item in plan.items:
            for material_id, amount in operations[item.operation_id].material_requirements.items():
                required[material_id] += amount
        violations = []
        for material_id, amount in required.items():
            material = state.material(material_id)
            available = material.available if material else 0
            if amount > available:
                violations.append(
                    ConstraintViolation(
                        constraint="inventory_availability",
                        severity="high",
                        message=f"{material_id} requires {amount}, available {available}",
                        related_ids=[material_id],
                    )
                )
        return violations

    def _worker_skill(self, state: FactoryState, plan: SchedulePlan) -> List[ConstraintViolation]:
        workers = {worker.id: worker for worker in state.workers}
        operations = {operation.id: operation for order in state.orders for operation in order.operations}
        violations = []
        for item in plan.items:
            operation = operations[item.operation_id]
            if not operation.required_worker_skill or not item.worker_id:
                continue
            worker = workers.get(item.worker_id)
            if worker is None or operation.required_worker_skill not in worker.skills:
                violations.append(
                    ConstraintViolation(
                        constraint="worker_skill_match",
                        severity="high",
                        message=f"{item.worker_id} lacks skill {operation.required_worker_skill}",
                        related_ids=[item.worker_id or "", operation.id],
                    )
                )
        return violations

    def _due_dates(self, state: FactoryState, plan: SchedulePlan) -> List[ConstraintViolation]:
        orders = {order.id: order for order in state.orders}
        by_order: Dict[str, int] = defaultdict(int)
        for item in plan.items:
            by_order[item.order_id] = max(by_order[item.order_id], item.end_minute)
        violations = []
        for order_id, end_minute in by_order.items():
            order = orders[order_id]
            if end_minute > order.due_minute and order.priority == "urgent":
                violations.append(
                    ConstraintViolation(
                        constraint="urgent_order_due_date",
                        severity="high",
                        message=f"{order_id} finishes at {end_minute}, due {order.due_minute}",
                        related_ids=[order_id],
                    )
                )
        return violations

    def _safety(self, state: FactoryState, plan: SchedulePlan) -> List[ConstraintViolation]:
        max_safety = {machine.id: machine.safety_level + 2 for machine in state.machines}
        operations = {operation.id: operation for order in state.orders for operation in order.operations}
        violations = []
        for item in plan.items:
            operation = operations[item.operation_id]
            if operation.safety_level > max_safety.get(item.machine_id, 0):
                violations.append(
                    ConstraintViolation(
                        constraint="safety_level",
                        severity="critical",
                        message=f"{item.machine_id} safety level is insufficient for {operation.id}",
                        related_ids=[item.machine_id, operation.id],
                    )
                )
        return violations


class RewardCalculator:
    def calculate(self, state: FactoryState, plan: SchedulePlan, agent_call_count: int = 0) -> float:
        metrics = self.metrics(state, plan, agent_call_count)
        return -(
            metrics["tardiness_minutes"] * 0.40
            + metrics["safety_risk"] * 0.30
            + metrics["switch_cost"] * 0.15
            + metrics["inventory_waste"] * 0.10
            + metrics["agent_call_cost"] * 0.05
        )

    def metrics(self, state: FactoryState, plan: SchedulePlan, agent_call_count: int = 0) -> Dict[str, float]:
        orders = {order.id: order for order in state.orders}
        operations = {operation.id: operation for order in state.orders for operation in order.operations}
        by_order: Dict[str, int] = defaultdict(int)
        switch_cost = 0
        makespan = 0
        for item in plan.items:
            by_order[item.order_id] = max(by_order[item.order_id], item.end_minute)
            makespan = max(makespan, item.end_minute)
            switch_cost += operations[item.operation_id].switch_cost_minutes
        tardiness = sum(max(0, end - orders[order_id].due_minute) for order_id, end in by_order.items())
        safety_risk = sum(3 for violation in plan.violations if violation.severity == "critical")
        used_material: Dict[str, int] = defaultdict(int)
        for item in plan.items:
            for material_id, amount in operations[item.operation_id].material_requirements.items():
                used_material[material_id] += amount
        inventory_waste = sum(
            max(0, (state.material(material_id).available if state.material(material_id) else 0) - amount)
            for material_id, amount in used_material.items()
        )
        return {
            "tardiness_minutes": float(tardiness),
            "safety_risk": float(safety_risk),
            "switch_cost": float(switch_cost),
            "inventory_waste": float(inventory_waste),
            "agent_call_cost": float(agent_call_count),
            "scheduled_operations": float(len(plan.items)),
            "violation_count": float(len(plan.violations)),
            "makespan": float(makespan),
        }


class IndustrialScheduleSolver:
    def __init__(self, time_limit_seconds: float = 60.0) -> None:
        self.time_limit_seconds = time_limit_seconds
        self.validator = ConstraintValidator()
        self.reward_calculator = RewardCalculator()

    def solve(self, state: FactoryState, agent_call_count: int = 0) -> Dict[str, object]:
        operations, pre_violations = self._eligible_operations(state)
        if cp_model is None:
            plan = self._greedy_schedule(state, operations)
            plan.metrics["solver"] = "greedy_fallback_no_ortools"
        else:
            plan = self._cp_sat_schedule(state, operations)
            plan.metrics["solver"] = "ortools_cp_sat"
        plan.violations = self.validator.validate(state, plan) + pre_violations
        plan.metrics.update(self.reward_calculator.metrics(state, plan, agent_call_count=agent_call_count))
        plan.metrics["reward"] = self.reward_calculator.calculate(state, plan, agent_call_count=agent_call_count)
        alternatives = self._alternatives(state, plan)
        return {
            "best_plan": plan,
            "alternative_plans": alternatives,
            "violations": plan.violations,
            "metrics": plan.metrics,
        }

    def _eligible_operations(self, state: FactoryState) -> Tuple[List[Tuple[Order, Operation]], List[ConstraintViolation]]:
        remaining_material = {material.id: material.available for material in state.materials}
        items: List[Tuple[Order, Operation]] = []
        violations: List[ConstraintViolation] = []
        for order in sorted(state.orders, key=lambda order: (-PRIORITY_WEIGHT[order.priority], order.due_minute)):
            required: Dict[str, int] = defaultdict(int)
            for operation in order.operations:
                for material_id, amount in operation.material_requirements.items():
                    required[material_id] += amount
            if any(remaining_material.get(material_id, 0) < amount for material_id, amount in required.items()):
                for material_id, amount in required.items():
                    if remaining_material.get(material_id, 0) < amount:
                        violations.append(
                            ConstraintViolation(
                                constraint="inventory_availability",
                                severity="high",
                                message=f"Order {order.id} blocked: {material_id} requires {amount}, available {remaining_material.get(material_id, 0)}",
                                related_ids=[order.id, material_id],
                            )
                        )
                continue
            for material_id, amount in required.items():
                remaining_material[material_id] -= amount
            for operation in order.operations:
                if not self._eligible_machines(state, operation):
                    violations.append(
                        ConstraintViolation(
                            constraint="machine_capability_or_failure",
                            severity="critical",
                            message=f"No available machine can perform {operation.id}",
                            related_ids=[operation.id],
                        )
                    )
                    continue
                if operation.required_worker_skill and state.worker_with_skill(operation.required_worker_skill) is None:
                    violations.append(
                        ConstraintViolation(
                            constraint="worker_skill_match",
                            severity="high",
                            message=f"No worker has skill {operation.required_worker_skill} for {operation.id}",
                            related_ids=[operation.id],
                        )
                    )
                    continue
                items.append((order, operation))
        return items, violations

    def _eligible_machines(self, state: FactoryState, operation: Operation) -> List[Machine]:
        return [
            machine
            for machine in state.machines
            if machine.status != "failed" and operation.required_capability in machine.capabilities
        ]

    def _worker_for(self, state: FactoryState, operation: Operation) -> Optional[Worker]:
        return state.worker_with_skill(operation.required_worker_skill)

    def _duration_on(self, machine: Machine, operation: Operation) -> int:
        return max(1, int(round((operation.duration_minutes + operation.switch_cost_minutes) / machine.efficiency)))

    def _cp_sat_schedule(self, state: FactoryState, items: List[Tuple[Order, Operation]]) -> SchedulePlan:
        model = cp_model.CpModel()
        horizon = max([order.due_minute for order, _ in items] + [24 * 60]) + 8 * 60
        starts: Dict[str, object] = {}
        ends: Dict[str, object] = {}
        machine_bools: Dict[Tuple[str, str], object] = {}
        machine_intervals: Dict[str, List[object]] = defaultdict(list)
        orders = {order.id: order for order, _ in items}

        for _, operation in items:
            starts[operation.id] = model.NewIntVar(0, horizon, f"start_{operation.id}")
            ends[operation.id] = model.NewIntVar(0, horizon, f"end_{operation.id}")
            choices = []
            for machine in self._eligible_machines(state, operation):
                assigned = model.NewBoolVar(f"{operation.id}_on_{machine.id}")
                machine_bools[(operation.id, machine.id)] = assigned
                interval = model.NewOptionalIntervalVar(
                    starts[operation.id],
                    self._duration_on(machine, operation),
                    ends[operation.id],
                    assigned,
                    f"interval_{operation.id}_{machine.id}",
                )
                machine_intervals[machine.id].append(interval)
                choices.append(assigned)
            model.Add(sum(choices) == 1)

        operation_ids = {operation.id for _, operation in items}
        for _, operation in items:
            for predecessor_id in operation.predecessors:
                if predecessor_id in operation_ids:
                    model.Add(starts[operation.id] >= ends[predecessor_id])
        for intervals in machine_intervals.values():
            model.AddNoOverlap(intervals)

        tardiness_vars = []
        for order_id, order in orders.items():
            order_end = model.NewIntVar(0, horizon, f"order_end_{order_id}")
            operation_ends = [ends[operation.id] for item_order, operation in items if item_order.id == order_id]
            if operation_ends:
                model.AddMaxEquality(order_end, operation_ends)
                tardiness = model.NewIntVar(0, horizon, f"tardiness_{order_id}")
                model.Add(tardiness >= order_end - order.due_minute)
                model.Add(tardiness >= 0)
                tardiness_vars.append(tardiness * PRIORITY_WEIGHT[order.priority])
        if ends:
            makespan = model.NewIntVar(0, horizon, "makespan")
            model.AddMaxEquality(makespan, list(ends.values()))
            model.Minimize((sum(tardiness_vars) * 100 if tardiness_vars else 0) + makespan)
        else:
            model.Minimize(0)

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = self.time_limit_seconds
        solver.parameters.num_search_workers = 8
        solver.parameters.linearization_level = 2
        solver.parameters.symmetry_level = 2
        status = solver.Solve(model)
        if status not in {cp_model.OPTIMAL, cp_model.FEASIBLE}:
            plan = self._greedy_schedule(state, items)
            plan.metrics["solver_status"] = "cp_sat_infeasible_fallback"
            return plan

        schedule_items: List[ScheduleItem] = []
        for order, operation in items:
            assigned_machine = None
            for machine in self._eligible_machines(state, operation):
                if solver.BooleanValue(machine_bools[(operation.id, machine.id)]):
                    assigned_machine = machine
                    break
            if assigned_machine is None:
                continue
            worker = self._worker_for(state, operation)
            schedule_items.append(
                ScheduleItem(
                    order_id=order.id,
                    operation_id=operation.id,
                    machine_id=assigned_machine.id,
                    worker_id=worker.id if worker else None,
                    start_minute=solver.Value(starts[operation.id]),
                    end_minute=solver.Value(ends[operation.id]),
                )
            )
        return SchedulePlan(items=sorted(schedule_items, key=lambda item: (item.start_minute, item.end_minute)))

    def _greedy_schedule(self, state: FactoryState, items: List[Tuple[Order, Operation]]) -> SchedulePlan:
        machine_available: Dict[str, int] = defaultdict(int)
        operation_end: Dict[str, int] = {}
        schedule_items: List[ScheduleItem] = []
        for order, operation in sorted(items, key=lambda pair: (-PRIORITY_WEIGHT[pair[0].priority], pair[0].due_minute, pair[1].id)):
            best = None
            predecessor_end = max([operation_end.get(pred, 0) for pred in operation.predecessors] or [0])
            for machine in self._eligible_machines(state, operation):
                start = max(machine_available[machine.id], predecessor_end)
                end = start + self._duration_on(machine, operation)
                if best is None or end < best[2]:
                    best = (machine, start, end)
            if best is None:
                continue
            machine, start, end = best
            worker = self._worker_for(state, operation)
            machine_available[machine.id] = end
            operation_end[operation.id] = end
            schedule_items.append(
                ScheduleItem(
                    order_id=order.id,
                    operation_id=operation.id,
                    machine_id=machine.id,
                    worker_id=worker.id if worker else None,
                    start_minute=start,
                    end_minute=end,
                )
            )
        return SchedulePlan(items=schedule_items)

    def _alternatives(self, state: FactoryState, plan: SchedulePlan) -> List[SchedulePlan]:
        if not plan.items:
            return []
        delayed_items = [
            item.model_copy(update={"start_minute": item.start_minute + 15, "end_minute": item.end_minute + 15, "status": "alternative"})
            for item in plan.items
        ]
        alternative = SchedulePlan(items=delayed_items, objective="backup plan with 15 minute safety buffer")
        alternative.violations = self.validator.validate(state, alternative)
        alternative.metrics.update(self.reward_calculator.metrics(state, alternative))
        return [alternative]
