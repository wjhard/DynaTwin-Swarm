from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator


RiskLevel = Literal["low", "medium", "high", "critical"]
MachineStatus = Literal["available", "busy", "failed", "maintenance"]
OrderPriority = Literal["normal", "high", "urgent"]
OrderStatus = Literal["pending", "scheduled", "in_progress", "completed", "blocked"]


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:8]}"


class DynaTwinModel(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_assignment=True)


class Machine(DynaTwinModel):
    id: str
    name: str
    machine_type: str
    capabilities: List[str] = Field(default_factory=list)
    status: MachineStatus = "available"
    efficiency: float = Field(default=1.0, gt=0.0)
    current_order_id: Optional[str] = None
    temperature_c: float = 25.0
    safety_level: int = Field(default=1, ge=1)


class Operation(DynaTwinModel):
    id: str
    order_id: str
    name: str
    required_capability: str
    duration_minutes: int = Field(gt=0)
    predecessors: List[str] = Field(default_factory=list)
    material_requirements: Dict[str, int] = Field(default_factory=dict)
    required_worker_skill: Optional[str] = None
    safety_level: int = Field(default=1, ge=1)
    switch_cost_minutes: int = Field(default=0, ge=0)


class Order(DynaTwinModel):
    id: str
    priority: OrderPriority = "normal"
    due_minute: int = Field(ge=0)
    operations: List[Operation] = Field(default_factory=list)
    quantity: int = Field(default=1, ge=1)
    created_minute: int = Field(default=0, ge=0)
    status: OrderStatus = "pending"


class Material(DynaTwinModel):
    id: str
    name: str
    quantity: int = Field(ge=0)
    reserved: int = Field(default=0, ge=0)
    unit: str = "pcs"

    @property
    def available(self) -> int:
        return max(0, self.quantity - self.reserved)


class Worker(DynaTwinModel):
    id: str
    name: str
    skills: List[str] = Field(default_factory=list)
    available: bool = True
    assigned_machine_ids: List[str] = Field(default_factory=list)


class MachineAlert(DynaTwinModel):
    id: str = Field(default_factory=lambda: new_id("alert"))
    machine_id: str
    alert_type: str
    severity: RiskLevel
    message: str
    minute: int = Field(default=0, ge=0)
    requires_stop: bool = False


class ConstraintViolation(DynaTwinModel):
    id: str = Field(default_factory=lambda: new_id("violation"))
    constraint: str
    severity: RiskLevel = "medium"
    message: str
    related_ids: List[str] = Field(default_factory=list)


class ScheduleItem(DynaTwinModel):
    order_id: str
    operation_id: str
    machine_id: str
    worker_id: Optional[str] = None
    start_minute: int = Field(ge=0)
    end_minute: int = Field(ge=0)
    status: Literal["planned", "blocked", "alternative"] = "planned"

    @field_validator("end_minute")
    @classmethod
    def end_after_start(cls, value: int, info):
        start = info.data.get("start_minute")
        if start is not None and value < start:
            raise ValueError("end_minute must be greater than or equal to start_minute")
        return value


class SchedulePlan(DynaTwinModel):
    id: str = Field(default_factory=lambda: new_id("plan"))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    items: List[ScheduleItem] = Field(default_factory=list)
    alternative_plans: List[Dict[str, Any]] = Field(default_factory=list)
    violations: List[ConstraintViolation] = Field(default_factory=list)
    metrics: Dict[str, float] = Field(default_factory=dict)
    objective: str = "minimize tardiness under safety and resource constraints"


class ReflActDecision(DynaTwinModel):
    current_state: str
    goal: str
    gap: str
    constraints: List[str] = Field(default_factory=list)
    risk_level: RiskLevel = "low"
    recommended_action: str
    evidence: List[str] = Field(default_factory=list)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class AgentDecisionTrace(DynaTwinModel):
    agent_name: str
    decision: ReflActDecision
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    elapsed_ms: float = Field(default=0.0, ge=0.0)
    provider: str = "mock"
    evidence: List[str] = Field(default_factory=list)


class TaskProfile(DynaTwinModel):
    task_id: str = Field(default_factory=lambda: new_id("task"))
    task_type: str
    risk_level: RiskLevel = "low"
    machine_alert_count: int = Field(default=0, ge=0)
    urgent_order_count: int = Field(default=0, ge=0)
    resource_conflict_count: int = Field(default=0, ge=0)
    inventory_shortage_count: int = Field(default=0, ge=0)
    worker_conflict_count: int = Field(default=0, ge=0)
    requires_parallel_analysis: bool = False
    requires_critic_review: bool = False

    def feature_dict(self) -> Dict[str, Any]:
        return self.model_dump()


class TopologySelection(DynaTwinModel):
    task_id: str
    topology_name: str
    selector_name: str = "rule_based"
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    candidates: List[str] = Field(default_factory=list)
    reason: str = ""


class ExecutionRecord(DynaTwinModel):
    task_id: str
    task_profile: TaskProfile
    selected_topology: Optional[TopologySelection] = None
    agent_traces: List[AgentDecisionTrace] = Field(default_factory=list)
    best_plan: Optional[SchedulePlan] = None
    alternative_plans: List[SchedulePlan] = Field(default_factory=list)
    risk_summary: Dict[str, Any] = Field(default_factory=dict)
    metrics: Dict[str, float] = Field(default_factory=dict)
    events: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FactoryState(DynaTwinModel):
    now_minute: int = Field(default=0, ge=0)
    machines: List[Machine] = Field(default_factory=list)
    orders: List[Order] = Field(default_factory=list)
    materials: List[Material] = Field(default_factory=list)
    workers: List[Worker] = Field(default_factory=list)
    alerts: List[MachineAlert] = Field(default_factory=list)
    events: List[Dict[str, Any]] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def machine(self, machine_id: str) -> Optional[Machine]:
        return next((machine for machine in self.machines if machine.id == machine_id), None)

    def material(self, material_id: str) -> Optional[Material]:
        return next((material for material in self.materials if material.id == material_id), None)

    def worker_with_skill(self, skill: Optional[str]) -> Optional[Worker]:
        if skill is None:
            return next((worker for worker in self.workers if worker.available), None)
        return next((worker for worker in self.workers if worker.available and skill in worker.skills), None)
