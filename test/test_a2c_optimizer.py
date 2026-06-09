from swarm.domain.manufacturing import FactorySimulator, IndustrialScheduleSolver
from swarm.optimizer.edge_optimizer.a2c import A2CEdgeOptimizer


def test_a2c_optimizer_step_updates_logits_and_topk():
    simulator = FactorySimulator()
    state = simulator.scenario("main")
    profile = simulator.profile_task(state)
    base_reward = float(IndustrialScheduleSolver(time_limit_seconds=1).solve(state)["metrics"]["reward"])
    optimizer = A2CEdgeOptimizer(seed=1)
    before = dict(optimizer.logits)

    result = optimizer.step(profile, base_reward)

    assert result["topology"] in optimizer.logits
    assert optimizer.logits != before
    assert optimizer.store.top()
