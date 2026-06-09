from __future__ import annotations

from typing import Any, Dict, List, Optional

from swarm.domain.manufacturing.models import AgentDecisionTrace, FactoryState, TaskProfile
from swarm.environment.agents.industrial.reflact import ReflActStep as IndustrialReflActStep


class ReflActStep:
    def __init__(self, agent_names: List[str], provider: str = "mock") -> None:
        self.agent_names = agent_names
        self.provider = provider

    def run(self, state: FactoryState, profile: TaskProfile, context: Optional[Dict[str, Any]] = None) -> List[AgentDecisionTrace]:
        return IndustrialReflActStep(self.agent_names, provider=self.provider).run(state, profile, context=context)
