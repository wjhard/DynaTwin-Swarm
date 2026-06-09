from swarm.domain.manufacturing import ConstraintValidator, FactorySimulator, IndustrialScheduleSolver


def test_schedule_solver_returns_best_plan_and_metrics():
    simulator = FactorySimulator()
    state = simulator.scenario("normal")

    result = IndustrialScheduleSolver(time_limit_seconds=2).solve(state, agent_call_count=3)
    plan = result["best_plan"]

    assert plan.items
    assert result["alternative_plans"]
    assert "reward" in result["metrics"]
    assert not ConstraintValidator().validate(state, plan)


def test_schedule_solver_reports_inventory_blocking_in_main_scenario():
    simulator = FactorySimulator()
    state = simulator.scenario("main")

    result = IndustrialScheduleSolver(time_limit_seconds=2).solve(state)

    assert any(violation.constraint == "inventory_availability" for violation in result["violations"])
