from fastapi.testclient import TestClient

from backend.main import create_app
from swarm.persistence import SQLiteRepository


def test_api_health_and_run_task(tmp_path):
    app = create_app(SQLiteRepository(str(tmp_path / "api.db")))
    client = TestClient(app)

    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    response = client.post("/api/tasks/run", json={"scenario": "main"})
    payload = response.json()

    assert response.status_code == 200
    assert payload["selected_topology"] == "high_risk_review"
    assert payload["agent_traces"]
    assert payload["best_plan"]["items"]


def test_api_event_and_latest_endpoints(tmp_path):
    app = create_app(SQLiteRepository(str(tmp_path / "api.db")))
    client = TestClient(app)

    client.post("/api/events/machine-alert", json={"machine_id": "M3"})
    client.post("/api/events/order-created", json={"order_id": "O4"})

    assert client.get("/api/state").json()["machines"]
    assert client.get("/api/events/latest").json()["events"]
