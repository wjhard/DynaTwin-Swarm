from fastapi.testclient import TestClient

from backend.main import create_app
from swarm.persistence import SQLiteRepository


def test_dashboard_websocket_sends_snapshot(tmp_path):
    app = create_app(SQLiteRepository(str(tmp_path / "ws.db")))
    client = TestClient(app)
    client.post("/api/tasks/run", json={"scenario": "main"})

    with client.websocket_connect("/ws/dashboard") as websocket:
        payload = websocket.receive_json()

    assert "state" in payload
    assert "execution" in payload
    assert payload["execution"]["selected_topology"]["topology_name"] == "high_risk_review"
