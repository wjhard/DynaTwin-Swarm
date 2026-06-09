from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional

from swarm.domain.manufacturing.models import AgentDecisionTrace, FactoryState, TaskProfile
from swarm.environment.agents.industrial.agents import BaseIndustrialAgent, build_agent


class ReflActStep:
    def __init__(self, agents: Iterable[str | BaseIndustrialAgent], provider: str = "mock") -> None:
        self.agents: List[BaseIndustrialAgent] = [
            agent if isinstance(agent, BaseIndustrialAgent) else build_agent(agent, provider=provider)
            for agent in agents
        ]

    def run(self, state: FactoryState, profile: TaskProfile, context: Optional[Dict[str, Any]] = None) -> List[AgentDecisionTrace]:
        context = context or {}
        traces: List[AgentDecisionTrace] = []
        for agent in self.agents:
            trace = agent.run(state, profile, context={**context, "previous_traces": traces})
            traces.append(trace)
        return traces
