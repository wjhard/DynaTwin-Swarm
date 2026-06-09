from swarm.domain.manufacturing import FactorySimulator, ReflActDecision
from swarm.environment.agents.industrial import (
    ConstraintAgent,
    CriticAgent,
    DiagnosisAgent,
    MonitorAgent,
    OrderAgent,
    ReportAgent,
    ResourceAgent,
    RiskAgent,
    ScheduleAgent,
    TaskRouterAgent,
)


def test_all_industrial_agents_return_reflact_decisions():
    simulator = FactorySimulator()
    state = simulator.scenario("main")
    profile = simulator.profile_task(state)

    for agent_cls in [
        TaskRouterAgent,
        MonitorAgent,
        DiagnosisAgent,
        OrderAgent,
        ResourceAgent,
        ScheduleAgent,
        ConstraintAgent,
        RiskAgent,
        CriticAgent,
        ReportAgent,
    ]:
        trace = agent_cls(provider="mock").run(state, profile)
        assert trace.agent_name == agent_cls.agent_name
        assert isinstance(trace.decision, ReflActDecision)
        assert trace.decision.risk_level == "critical"
        assert trace.elapsed_ms >= 0
        assert trace.evidence


def test_invalid_agent_output_falls_back_to_valid_reflact_decision():
    class BrokenAgent(MonitorAgent):
        agent_name = "BrokenAgent"

        def decide(self, state, profile, context):
            return {"not": "the required schema"}

    simulator = FactorySimulator()
    state = simulator.scenario("main")
    profile = simulator.profile_task(state)

    trace = BrokenAgent(provider="mock").run(state, profile)

    assert trace.decision.recommended_action.startswith("Escalate")
    assert trace.decision.confidence == 0.5
