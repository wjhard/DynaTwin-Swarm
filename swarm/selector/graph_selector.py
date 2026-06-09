from __future__ import annotations

from swarm.domain.manufacturing.models import TaskProfile, TopologySelection
from swarm.selector.topology import TopologyRegistry


class RuleBasedGraphSelector:
    name = "rule_based"

    def select(self, profile: TaskProfile) -> TopologySelection:
        topology = "serial_chain"
        reason = "normal task uses serial chain"
        confidence = 0.78

        if profile.risk_level in {"high", "critical"} and profile.machine_alert_count:
            topology = "high_risk_review"
            reason = "high-risk equipment anomaly requires risk and critic review"
            confidence = 0.96
        elif profile.task_type in {"complex_composite_incident", "high_risk_composite_incident"} and profile.requires_critic_review:
            topology = "supervisor_tree"
            reason = "complex composite task requires supervisor coordination"
            confidence = 0.9
        elif profile.resource_conflict_count or profile.requires_parallel_analysis:
            topology = "parallel_fusion"
            reason = "resource conflict benefits from parallel specialist analysis"
            confidence = 0.86

        return TopologySelection(
            task_id=profile.task_id,
            topology_name=topology,
            selector_name=self.name,
            confidence=confidence,
            candidates=TopologyRegistry.names(),
            reason=reason,
        )
