from swarm.domain.manufacturing import FactorySimulator


def test_main_scenario_contains_required_incidents():
    simulator = FactorySimulator(seed=7)
    state = simulator.scenario("main")
    profile = simulator.profile_task(state)

    assert state.machine("M3").status == "failed"
    assert any(order.id == "O4" and order.priority == "urgent" for order in state.orders)
    assert any(alert.machine_id == "M3" and alert.requires_stop for alert in state.alerts)
    assert profile.risk_level == "critical"
    assert profile.requires_critic_review is True


def test_scenarios_are_deterministic_and_exportable(tmp_path):
    simulator = FactorySimulator(seed=42)
    state = simulator.scenario("inventory_shortage")
    path = tmp_path / "state.json"

    simulator.export_json(state, str(path))
    loaded = simulator.import_json(str(path))

    assert loaded.model_dump() == state.model_dump()
    assert loaded.metadata["scenario"] == "inventory_shortage"


def test_step_applies_named_event():
    simulator = FactorySimulator(seed=42)
    state = simulator.base_state()

    stepped = simulator.step(state, "urgent_order_o4")

    assert stepped.now_minute == 15
    assert any(order.id == "O4" for order in stepped.orders)
