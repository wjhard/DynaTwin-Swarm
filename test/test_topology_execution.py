from swarm.domain.manufacturing import FactorySimulator
from swarm.selector import IndustrialTopologyExecutor, RuleBasedGraphSelector


def test_topology_executor_runs_selected_high_risk_review():
    simulator = FactorySimulator()
    state = simulator.scenario("main")
    profile = simulator.profile_task(state)
    selection = RuleBasedGraphSelector().select(profile)

    traces = IndustrialTopologyExecutor(provider="mock").execute(state, profile, selection)

    assert selection.topology_name == "high_risk_review"
    assert traces[0].agent_name == "TaskRouterAgent"
    assert traces[-1].agent_name == "ReportAgent"
    assert any(trace.agent_name == "FinalDecisionAgent" for trace in traces)
