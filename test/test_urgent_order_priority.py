from swarm.domain.manufacturing import FactorySimulator, IndustrialScheduleSolver


def test_urgent_order_is_scheduled_before_high_priority_precision_work():
    simulator = FactorySimulator()
    state = simulator.scenario("main")

    result = IndustrialScheduleSolver(time_limit_seconds=2).solve(state)
    plan = result["best_plan"]
    by_operation = {item.operation_id: item for item in plan.items}

    assert "O4-MILL" in by_operation
    if "O2-MILL" in by_operation:
        assert by_operation["O4-MILL"].start_minute <= by_operation["O2-MILL"].start_minute
