from swarm.domain.manufacturing import FactorySimulator, IndustrialScheduleSolver
from swarm.persistence import SQLiteRepository
from swarm.selector import RuleBasedGraphSelector


def test_sqlite_repository_persists_state_schedule_topology_events(tmp_path):
    repo = SQLiteRepository(str(tmp_path / "repo.db"))
    simulator = FactorySimulator()
    state = simulator.scenario("main")
    profile = simulator.profile_task(state)
    selection = RuleBasedGraphSelector().select(profile)
    plan = IndustrialScheduleSolver(time_limit_seconds=2).solve(state)["best_plan"]

    repo.save_state(state)
    repo.save_topology(selection)
    repo.save_schedule(plan)
    repo.add_event({"type": "test_event"})

    assert repo.latest_state().machine("M3").status == "failed"
    assert repo.latest_topology().topology_name == "high_risk_review"
    assert repo.latest_schedule().items
    assert repo.latest_events()[0]["type"] == "test_event"
