from backend.service import DynaTwinService
from swarm.persistence import SQLiteRepository


def test_end_to_end_service_demo(tmp_path):
    service = DynaTwinService(SQLiteRepository(str(tmp_path / "demo.db")), provider="mock")

    result = service.run_task("main")

    assert result["task_profile"]["risk_level"] == "critical"
    assert result["selected_topology"] == "high_risk_review"
    assert result["risk_summary"]["violation_count"] >= 1
    assert result["metrics"]["scheduled_operations"] > 0
