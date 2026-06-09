from swarm.domain.manufacturing import (
    ExecutionRecord,
    FactorySimulator,
    InMemoryFactoryStateStore,
    SQLiteFactoryStateStore,
)


def test_in_memory_factory_state_store_round_trip():
    simulator = FactorySimulator()
    state = simulator.scenario("normal")
    profile = simulator.profile_task(state)
    record = ExecutionRecord(task_id=profile.task_id, task_profile=profile)
    store = InMemoryFactoryStateStore()

    store.save_state(state)
    store.save_execution(record)

    assert store.load_latest_state().model_dump() == state.model_dump()
    assert store.load_latest_execution().task_profile.task_type == "normal_scheduling"


def test_sqlite_factory_state_store_round_trip(tmp_path):
    simulator = FactorySimulator()
    state = simulator.scenario("single_machine_failure")
    store = SQLiteFactoryStateStore(str(tmp_path / "dynatwin.db"))

    store.save_state(state)
    loaded = store.load_latest_state()

    assert loaded is not None
    assert loaded.machine("M3").status == "failed"
