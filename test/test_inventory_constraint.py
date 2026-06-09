from swarm.domain.manufacturing import FactorySimulator, IndustrialScheduleSolver


def test_inventory_shortage_blocks_some_orders_without_plan_violation():
    simulator = FactorySimulator()
    state = simulator.scenario("inventory_shortage")

    result = IndustrialScheduleSolver(time_limit_seconds=2).solve(state)
    plan = result["best_plan"]

    scheduled_orders = {item.order_id for item in plan.items}
    assert len(scheduled_orders) < len(state.orders)
    assert any(violation.constraint == "inventory_availability" for violation in result["violations"])
