from backend.main import create_app
from swarm.datasets import list_public_jobshop_datasets, public_jobshop_state
from swarm.persistence import SQLiteRepository


def test_public_jobshop_dataset_loads_ft06():
    datasets = list_public_jobshop_datasets()
    ft06 = next(dataset for dataset in datasets if dataset["id"] == "jsplib_ft06")

    assert ft06["job_count"] == 6
    assert ft06["machine_count"] == 6
    assert ft06["operation_count"] == 36
    assert ft06["best_known_makespan"] == 55

    state = public_jobshop_state("jsplib_ft06")
    assert len(state.machines) == 6
    assert len(state.orders) == 6
    assert sum(len(order.operations) for order in state.orders) == 36
    assert state.metadata["dataset_id"] == "jsplib_ft06"


def test_public_dataset_api_runs_scheduler(tmp_path):
    app = create_app(SQLiteRepository(str(tmp_path / "datasets.db")))
    client = app.test_client() if hasattr(app, "test_client") else None
    if client is None:
        from fastapi.testclient import TestClient

        client = TestClient(app)

    datasets = client.get("/api/datasets/public")
    assert datasets.status_code == 200
    assert datasets.json()["datasets"][0]["id"] == "jsplib_ft06"

    result = client.post("/api/datasets/public/jsplib_ft06/run")
    payload = result.json()

    assert result.status_code == 200
    assert payload["task_profile"]["risk_level"] == "low"
    assert payload["best_plan"]["items"]
    assert payload["metrics"]["scheduled_operations"] == 36
