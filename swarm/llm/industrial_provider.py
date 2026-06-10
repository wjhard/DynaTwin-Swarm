from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, Protocol

from swarm.domain.manufacturing.models import FactoryState, ReflActDecision, TaskProfile
from swarm.integrations.huawei.providers import MindIEChatProvider, PanguChatProvider


PROVIDER_RUNTIME_STATUS: Dict[str, str] = {}


def provider_runtime_status() -> Dict[str, str]:
    return dict(PROVIDER_RUNTIME_STATUS)


def _mark_provider_status(name: str, status: str) -> None:
    PROVIDER_RUNTIME_STATUS[name] = status


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
            _mark_provider_status("PanguLM", "mock")
            return f"{agent_name} Pangu mock fallback: PANGU_BASE_URL or PANGU_API_KEY not configured"
        try:
            provider = PanguChatProvider.from_env()
            response = provider.chat(self._messages(agent_name, state, profile, context))
            _mark_provider_status("PanguLM", "connected")
            return str(response["content"])
        except Exception as exc:
            _mark_provider_status("PanguLM", "error")
            return f"{agent_name} Pangu fallback after HTTP error: {exc.__class__.__name__}"

    def _messages(self, agent_name: str, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> list[Dict[str, str]]:
        no_think = os.getenv("PANGU_NO_THINK", "false").lower() in {"1", "true", "yes"}
        instruction = (
            "你是DynaTwin-Swarm工业数字孪生调度系统中的专业智能体。"
            "请基于给定工厂状态，用中文输出一段简洁、可审计的ReflAct决策建议，"
            "必须包含观察、风险判断和建议动作，不要编造不存在的数据。"
        )
        if no_think:
            instruction += " /no_think"
        failed = [machine.id for machine in state.machines if machine.status == "failed"]
        hot = [machine.id for machine in state.machines if machine.temperature_c >= 80]
        urgent = [order.id for order in state.orders if order.priority == "urgent"]
        summary = {
            "agent": agent_name,
            "task_type": profile.task_type,
            "risk_level": profile.risk_level,
            "selected_topology": context.get("topology"),
            "machines": len(state.machines),
            "failed_machines": failed,
            "hot_machines": hot,
            "urgent_orders": urgent,
            "alert_count": len(state.alerts),
            "inventory_shortage_count": profile.inventory_shortage_count,
            "resource_conflict_count": profile.resource_conflict_count,
            "worker_conflict_count": profile.worker_conflict_count,
            "recent_events": state.events[-5:],
        }
        return [
            {"role": "system", "content": instruction},
            {"role": "user", "content": f"请为当前Agent生成决策说明：{summary}"},
        ]


@dataclass
class MindIEIndustrialDecisionProvider:
    name: str = "mindie"
    base_url: str = ""

    def complete(self, agent_name: str, state: FactoryState, profile: TaskProfile, context: Dict[str, Any]) -> str:
        if not self.base_url:
            _mark_provider_status("MindIE", "mock")
            return f"{agent_name} MindIE mock fallback: MINDIE_BASE_URL not configured"
        try:
            response = MindIEChatProvider(base_url=self.base_url).chat(
                [{"role": "user", "content": f"{agent_name}: {profile.task_type} risk={profile.risk_level}"}]
            )
            _mark_provider_status("MindIE", "connected")
            return str(response["content"])
        except Exception as exc:
            _mark_provider_status("MindIE", "error")
            return f"{agent_name} MindIE fallback after HTTP error: {exc.__class__.__name__}"


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
