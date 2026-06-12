from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Type

from pydantic import ValidationError

from swarm.domain.manufacturing.models import (
    AgentDecisionTrace,
    FactoryState,
    ReflActDecision,
    TaskProfile,
)
from swarm.llm.industrial_provider import get_industrial_provider


class BaseIndustrialAgent:
    agent_name = "BaseIndustrialAgent"
    goal = "Support safe industrial scheduling."

    def __init__(self, provider: str = "mock") -> None:
        self.provider = get_industrial_provider(provider)

    def run(self, state: FactoryState, profile: TaskProfile, context: Optional[Dict[str, Any]] = None) -> AgentDecisionTrace:
        context = context or {}
        started = time.perf_counter()
        try:
            decision = self.decide(state, profile, context)
            if not isinstance(decision, ReflActDecision):
                decision = ReflActDecision.model_validate(decision)
        except (ValidationError, ValueError, TypeError) as exc:
            decision = self.fallback_decision(state, profile, str(exc))
        elapsed_ms = (time.perf_counter() - started) * 1000
        return AgentDecisionTrace(
            agent_name=self.agent_name,
            decision=decision,
            elapsed_ms=elapsed_ms,
            provider=self.provider.name,
            evidence=decision.evidence,
        )

    def decide(self, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> ReflActDecision:
        provider_note = self.provider.complete(self.agent_name, state, profile, context)
        return ReflActDecision(
            current_state=self.describe_state(state),
            goal=self.goal,
            gap=self.describe_gap(state, profile),
            constraints=self.constraints(state, profile),
            risk_level=profile.risk_level,
            recommended_action=self.recommend(state, profile, context),
            evidence=[provider_note, *self.evidence(state, profile)],
            confidence=self.confidence(profile),
        )

    def describe_state(self, state: FactoryState) -> str:
        failed = [machine.id for machine in state.machines if machine.status == "failed"]
        urgent = [order.id for order in state.orders if order.priority == "urgent"]
        operation_count = sum(len(order.operations) for order in state.orders)
        summary = f"{len(state.machines)} machines, failed={failed}, urgent_orders={urgent}, alerts={len(state.alerts)}"
        if len(state.machines) > 10 or operation_count > 100:
            summary += f", large-scale: {len(state.machines)} machines, {operation_count} operations"
        return summary

    def describe_gap(self, state: FactoryState, profile: TaskProfile) -> str:
        if profile.risk_level in {"high", "critical"}:
            return "Current capacity and safety state diverges from the safe on-time production goal."
        if profile.inventory_shortage_count:
            return "Material demand exceeds available stock."
        return "State is close to the production goal."

    def constraints(self, state: FactoryState, profile: TaskProfile) -> List[str]:
        constraints = ["failed machines cannot be scheduled", "operation precedence must be preserved"]
        if profile.urgent_order_count:
            constraints.append("urgent orders receive priority")
        if profile.inventory_shortage_count:
            constraints.append("material availability must be validated")
        return constraints

    def recommend(self, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        return "Continue with constraint-validated scheduling."

    def evidence(self, state: FactoryState, profile: TaskProfile) -> List[str]:
        return [event.get("type", "event") for event in state.events[-3:]]

    def confidence(self, profile: TaskProfile) -> float:
        return 0.86 if profile.risk_level in {"high", "critical"} else 0.78

    def fallback_decision(self, state: FactoryState, profile: TaskProfile, reason: str) -> ReflActDecision:
        return ReflActDecision(
            current_state=self.describe_state(state),
            goal=self.goal,
            gap="Agent decision validation failed; using deterministic fallback.",
            constraints=self.constraints(state, profile),
            risk_level=profile.risk_level,
            recommended_action="Escalate to constraint validation and safe fallback scheduling.",
            evidence=[f"fallback_reason={reason}"],
            confidence=0.5,
        )


class TaskRouterAgent(BaseIndustrialAgent):
    agent_name = "TaskRouterAgent"
    goal = "Classify the industrial task and route it to the right topology."

    def recommend(self, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        if profile.task_type == "large_scale_benchmark_scheduling":
            return "Route to parallel analysis topology for large-scale benchmark scheduling"
        if profile.risk_level == "critical":
            return "Route to high_risk_review topology."
        if profile.requires_parallel_analysis:
            return "Route to parallel analysis topology."
        return "Route to serial scheduling topology."


class SupervisorAgent(BaseIndustrialAgent):
    agent_name = "SupervisorAgent"
    goal = "Coordinate specialist agents for complex composite incidents."

    def recommend(self, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        return "Fan out diagnosis, order, resource, and risk analysis, then consolidate before scheduling."


class MonitorAgent(BaseIndustrialAgent):
    agent_name = "MonitorAgent"
    goal = "Monitor equipment, orders, inventory, and worker availability."

    def recommend(self, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        if state.alerts:
            return "Freeze unsafe machines and publish alerts before scheduling."
        return "No safety freeze required."

    def evidence(self, state: FactoryState, profile: TaskProfile) -> List[str]:
        return [f"{alert.machine_id}:{alert.alert_type}:{alert.severity}" for alert in state.alerts] or ["no machine alerts"]


class DiagnosisAgent(BaseIndustrialAgent):
    agent_name = "DiagnosisAgent"
    goal = "Diagnose machine faults and safe operating capacity."

    def recommend(self, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        failed = [machine.id for machine in state.machines if machine.status == "failed"]
        if failed:
            return f"Remove {', '.join(failed)} from candidate machines and reroute work."
        return "All machines can remain in the candidate pool."


class OrderAgent(BaseIndustrialAgent):
    agent_name = "OrderAgent"
    goal = "Assess due dates and urgent order pressure."

    def recommend(self, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        urgent = [order.id for order in state.orders if order.priority == "urgent"]
        if urgent:
            return f"Prioritize urgent orders {', '.join(urgent)} with due-date-aware scheduling."
        return "Schedule orders by due date and priority."


class ResourceAgent(BaseIndustrialAgent):
    agent_name = "ResourceAgent"
    goal = "Detect material, worker, and machine resource conflicts."

    def recommend(self, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        issues = []
        if profile.inventory_shortage_count:
            issues.append("material shortage")
        if profile.worker_conflict_count:
            issues.append("worker skill shortage")
        if profile.resource_conflict_count:
            issues.append("machine capacity conflict")
        return "Resolve " + ", ".join(issues) if issues else "No resource conflict detected."


class ScheduleAgent(BaseIndustrialAgent):
    agent_name = "ScheduleAgent"
    goal = "Prepare inputs for the industrial scheduling solver."

    def recommend(self, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        operation_count = sum(len(order.operations) for order in state.orders)
        if operation_count > 100:
            return f"Invoke CP-SAT solver with parallelization and beam-search heuristic for large-scale instance ({operation_count} operations)"
        return "Invoke CP-SAT solver with safety, inventory, due-date, and skill constraints."


class ConstraintAgent(BaseIndustrialAgent):
    agent_name = "ConstraintAgent"
    goal = "Ensure final schedules obey hard production constraints."

    def recommend(self, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        return "Validate machine capacity, failure exclusion, precedence, inventory, skills, due dates, and safety."


class RiskAgent(BaseIndustrialAgent):
    agent_name = "RiskAgent"
    goal = "Summarize operational risk before final approval."

    def recommend(self, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        if profile.risk_level == "critical":
            return "Require critic review and retain an alternative schedule."
        return "Proceed with standard risk logging."


class CriticAgent(BaseIndustrialAgent):
    agent_name = "CriticAgent"
    goal = "Critique the proposed schedule and reject unsafe shortcuts."

    def recommend(self, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        return "Reject any plan using failed equipment or unverified inventory."


class ReportAgent(BaseIndustrialAgent):
    agent_name = "ReportAgent"
    goal = "Produce an auditable industrial scheduling report."

    def recommend(self, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        return "Report selected topology, ReflAct trace, best plan, alternatives, risks, and Huawei adapter status."


class FinalDecisionAgent(BaseIndustrialAgent):
    agent_name = "FinalDecisionAgent"
    goal = "Approve the safest feasible decision after risk and critic review."

    def recommend(self, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        return "Approve only schedules that pass hard-constraint validation and include alternatives."


AGENT_CLASSES: Dict[str, Type[BaseIndustrialAgent]] = {
    cls.agent_name: cls
    for cls in [
        TaskRouterAgent,
        SupervisorAgent,
        MonitorAgent,
        DiagnosisAgent,
        OrderAgent,
        ResourceAgent,
        ScheduleAgent,
        ConstraintAgent,
        RiskAgent,
        CriticAgent,
        FinalDecisionAgent,
        ReportAgent,
    ]
}


def build_agent(agent_name: str, provider: str = "mock") -> BaseIndustrialAgent:
    try:
        return AGENT_CLASSES[agent_name](provider=provider)
    except KeyError as exc:
        raise ValueError(f"Unknown industrial agent: {agent_name}") from exc
