from swarm.domain.manufacturing import FactorySimulator
from swarm.environment.agents.industrial import ReflActStep


def test_reflact_step_runs_agents_in_order():
    simulator = FactorySimulator()
    state = simulator.scenario("main")
    profile = simulator.profile_task(state)

    traces = ReflActStep(["TaskRouterAgent", "MonitorAgent", "RiskAgent"], provider="mock").run(state, profile)

    assert [trace.agent_name for trace in traces] == ["TaskRouterAgent", "MonitorAgent", "RiskAgent"]
    assert all(trace.decision.current_state for trace in traces)
