from swarm.domain.manufacturing import FactorySimulator, IndustrialScheduleSolver


def test_failed_machine_is_not_scheduled():
    simulator = FactorySimulator()
    state = simulator.scenario("single_machine_failure")

    result = IndustrialScheduleSolver(time_limit_seconds=2).solve(state)
    plan = result["best_plan"]

    assert all(item.machine_id != "M3" for item in plan.items)
    assert all(violation.constraint != "failed_machine_exclusion" for violation in result["violations"])
