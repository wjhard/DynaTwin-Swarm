from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, Protocol

from swarm.domain.manufacturing.models import FactoryState, ReflActDecision, TaskProfile


class IndustrialDecisionProvider(Protocol):
    name: str

    def complete(self, agent_name: str, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        pass


@dataclass
class MockIndustrialDecisionProvider:
    name: str = "mock"

    def complete(self, agent_name: str, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        return f"{agent_name} mock decision for {profile.task_type} at risk {profile.risk_level}"


@dataclass
class PanguIndustrialDecisionProvider:
    name: str = "pangu"
    base_url: str = ""
    api_key: str = ""

    def complete(self, agent_name: str, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        if not self.base_url or not self.api_key:
            return f"{agent_name} Pangu mock fallback: PANGU_BASE_URL or PANGU_API_KEY not configured"
        return f"{agent_name} Pangu adapter prepared for {self.base_url}"


@dataclass
class MindIEIndustrialDecisionProvider:
    name: str = "mindie"
    base_url: str = ""

    def complete(self, agent_name: str, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        if not self.base_url:
            return f"{agent_name} MindIE mock fallback: MINDIE_BASE_URL not configured"
        return f"{agent_name} MindIE adapter prepared for {self.base_url}"


@dataclass
class OptionalOpenAIIndustrialDecisionProvider:
    name: str = "openai_optional"
    api_key: str = ""

    def complete(self, agent_name: str, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        if not self.api_key:
            return f"{agent_name} OpenAI optional mock fallback: OPENAI_API_KEY not configured"
        return f"{agent_name} OpenAI optional adapter prepared"


def get_industrial_provider(provider: str = "mock") -> IndustrialDecisionProvider:
    provider = provider or "mock"
    if provider == "mock":
        return MockIndustrialDecisionProvider()
    if provider == "pangu":
        return PanguIndustrialDecisionProvider(
            base_url=os.getenv("PANGU_BASE_URL", ""),
            api_key=os.getenv("PANGU_API_KEY", ""),
        )
    if provider == "mindie":
        return MindIEIndustrialDecisionProvider(base_url=os.getenv("MINDIE_BASE_URL", ""))
    if provider == "openai_optional":
        return OptionalOpenAIIndustrialDecisionProvider(api_key=os.getenv("OPENAI_API_KEY", ""))
    raise ValueError(f"Unknown industrial provider: {provider}")
