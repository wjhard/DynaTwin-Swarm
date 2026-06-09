from swarm.domain.manufacturing import FactorySimulator, TaskProfile
from swarm.selector import RuleBasedGraphSelector


def test_rule_selector_maps_normal_to_serial():
    simulator = FactorySimulator()
    profile = simulator.profile_task(simulator.scenario("normal"))

    selection = RuleBasedGraphSelector().select(profile)

    assert selection.topology_name == "serial_chain"


def test_rule_selector_maps_resource_conflict_to_parallel():
    profile = TaskProfile(
        task_type="multi_resource_conflict",
        risk_level="medium",
        resource_conflict_count=2,
        requires_parallel_analysis=True,
    )

    selection = RuleBasedGraphSelector().select(profile)

    assert selection.topology_name == "parallel_fusion"


def test_rule_selector_maps_complex_to_supervisor():
    profile = TaskProfile(
        task_type="complex_composite_incident",
        risk_level="high",
        requires_critic_review=True,
    )

    selection = RuleBasedGraphSelector().select(profile)

    assert selection.topology_name == "supervisor_tree"


def test_rule_selector_maps_high_risk_machine_alert_to_review():
    simulator = FactorySimulator()
    profile = simulator.profile_task(simulator.scenario("single_machine_failure"))

    selection = RuleBasedGraphSelector().select(profile)

    assert selection.topology_name == "high_risk_review"
    assert selection.confidence > 0.9
