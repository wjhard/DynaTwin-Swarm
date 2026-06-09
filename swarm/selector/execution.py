from __future__ import annotations

from typing import Dict, List

from swarm.domain.manufacturing.models import AgentDecisionTrace, FactoryState, TaskProfile, TopologySelection
from swarm.environment.agents.industrial.agents import build_agent
from swarm.selector.topology import TopologyRegistry


NODE_TO_AGENT: Dict[str, str] = {
    "TaskRouter": "TaskRouterAgent",
    "Supervisor": "SupervisorAgent",
    "Monitor": "MonitorAgent",
    "Diagnosis": "DiagnosisAgent",
    "Order": "OrderAgent",
    "Resource": "ResourceAgent",
    "Schedule": "ScheduleAgent",
    "Constraint": "ConstraintAgent",
    "Risk": "RiskAgent",
    "Critic": "CriticAgent",
    "FinalDecision": "FinalDecisionAgent",
    "Report": "ReportAgent",
}


class IndustrialTopologyExecutor:
    def __init__(self, provider: str = "mock") -> None:
        self.provider = provider

    def execute(self, state: FactoryState, profile: TaskProfile, selection: TopologySelection) -> List[AgentDecisionTrace]:
        template = TopologyRegistry.get(selection.topology_name)
        traces: List[AgentDecisionTrace] = []
        context = {
            "topology": template.name,
            "edges": template.edges,
            "selection_reason": selection.reason,
        }
        for node in template.topological_order():
            agent_name = NODE_TO_AGENT[node]
            trace = build_agent(agent_name, provider=self.provider).run(
                state,
                profile,
                context={**context, "previous_traces": traces},
            )
            traces.append(trace)
        return traces
