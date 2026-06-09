import pytest
from pydantic import ValidationError

from swarm.domain.manufacturing import ReflActDecision


def test_reflact_decision_schema_accepts_required_contract():
    decision = ReflActDecision(
        current_state="M3 failed, O4 urgent order present",
        goal="Create safe schedule",
        gap="Precision capacity is constrained",
        constraints=["failed machines cannot be scheduled", "urgent orders have priority"],
        risk_level="critical",
        recommended_action="Stop M3 and reschedule O2/O4 on M4",
        evidence=["M3 temperature exceeded threshold"],
        confidence=0.88,
    )

    assert decision.risk_level == "critical"
    assert decision.confidence == pytest.approx(0.88)


def test_reflact_decision_rejects_invalid_confidence():
    with pytest.raises(ValidationError):
        ReflActDecision(
            current_state="state",
            goal="goal",
            gap="gap",
            risk_level="low",
            recommended_action="act",
            confidence=2.0,
        )
