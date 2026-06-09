from swarm.domain.manufacturing import FactorySimulator, IndustrialScheduleSolver


def test_worker_skill_shortage_blocks_precision_operations():
    simulator = FactorySimulator()
    state = simulator.scenario("worker_skill_mismatch")

    result = IndustrialScheduleSolver(time_limit_seconds=2).solve(state)
    plan = result["best_plan"]

    assert all(not item.operation_id.endswith("MILL") for item in plan.items)
    assert any(violation.constraint == "worker_skill_match" for violation in result["violations"])
