from __future__ import annotations

from typing import Any, Dict

from swarm.datasets import list_public_jobshop_datasets, public_jobshop_state
from swarm.domain.manufacturing import ExecutionRecord, FactorySimulator, IndustrialScheduleSolver
from swarm.persistence import Repository
from swarm.selector import IndustrialTopologyExecutor, RuleBasedGraphSelector


class DynaTwinService:
    def __init__(self, repository: Repository, provider: str = "mock") -> None:
        self.repository = repository
        self.provider = provider
        self.simulator = FactorySimulator()

    def run_task(self, scenario: str = "main") -> Dict[str, Any]:
        state = self.simulator.scenario(scenario)
        return self.run_state(state)

    def run_public_dataset(self, dataset_id: str) -> Dict[str, Any]:
        state = public_jobshop_state(dataset_id)
        return self.run_state(state)

    def public_datasets(self) -> Dict[str, Any]:
        return {"datasets": list_public_jobshop_datasets()}

    def run_state(self, state) -> Dict[str, Any]:
        profile = self.simulator.profile_task(state)
        selection = RuleBasedGraphSelector().select(profile)
        traces = IndustrialTopologyExecutor(provider=self.provider).execute(state, profile, selection)
        solver_result = IndustrialScheduleSolver(time_limit_seconds=3).solve(state, agent_call_count=len(traces))
        best_plan = solver_result["best_plan"]
        alternatives = solver_result["alternative_plans"]
        risk_summary = {
            "risk_level": profile.risk_level,
            "violation_count": len(solver_result["violations"]),
            "critical_alerts": [alert.model_dump(mode="json") for alert in state.alerts if alert.severity == "critical"],
        }
        record = ExecutionRecord(
            task_id=profile.task_id,
            task_profile=profile,
            selected_topology=selection,
            agent_traces=traces,
            best_plan=best_plan,
            alternative_plans=alternatives,
            risk_summary=risk_summary,
            metrics=solver_result["metrics"],
            events=state.events,
        )
        self.repository.save_state(state)
        self.repository.save_topology(selection)
        self.repository.save_schedule(best_plan)
        self.repository.save_execution(record)
        for event in state.events:
            self.repository.add_event(event)
        return {
            "task_id": profile.task_id,
            "task_profile": profile.model_dump(mode="json"),
            "selected_topology": selection.topology_name,
            "topology_selection": selection.model_dump(mode="json"),
            "agent_traces": [trace.model_dump(mode="json") for trace in traces],
            "best_plan": best_plan.model_dump(mode="json"),
            "alternative_plans": [plan.model_dump(mode="json") for plan in alternatives],
            "risk_summary": risk_summary,
            "metrics": solver_result["metrics"],
        }

    def machine_alert(self, machine_id: str = "M3") -> Dict[str, Any]:
        state = self.repository.latest_state() or self.simulator.base_state()
        if machine_id == "M3":
            state = self.simulator.trigger_m3_overheat(state)
        self.repository.save_state(state)
        event = {"type": "machine_alert", "machine_id": machine_id}
        self.repository.add_event(event)
        return state.model_dump(mode="json")

    def order_created(self, order_id: str = "O4") -> Dict[str, Any]:
        state = self.repository.latest_state() or self.simulator.base_state()
        if order_id == "O4":
            state = self.simulator.create_urgent_order_o4(state)
        self.repository.save_state(state)
        event = {"type": "order_created", "order_id": order_id}
        self.repository.add_event(event)
        return state.model_dump(mode="json")

    def reset_demo(self) -> Dict[str, Any]:
        state = self.simulator.base_state()
        state.metadata["scenario"] = "normal"
        self.repository.save_state(state)
        for event in state.events:
            self.repository.add_event(event)
        return state.model_dump(mode="json")
