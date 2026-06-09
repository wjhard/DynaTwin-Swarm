from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import FastAPI, WebSocket
from pydantic import BaseModel

from backend.service import DynaTwinService
from swarm.persistence import SQLiteRepository


class RunTaskRequest(BaseModel):
    scenario: str = "main"


def create_app(repository=None) -> FastAPI:
    repo = repository or SQLiteRepository(os.getenv("SQLITE_PATH", "./data/dynatwin.db"))
    service = DynaTwinService(repo, provider=os.getenv("LLM_PROVIDER", "mock"))
    app = FastAPI(title="DynaTwin-Swarm API")
    app.state.repository = repo
    app.state.service = service

    @app.get("/health")
    def health() -> Dict[str, Any]:
        return {"status": "ok", "mode": os.getenv("APP_ENV", "local")}

    @app.post("/api/tasks/run")
    def run_task(request: RunTaskRequest) -> Dict[str, Any]:
        return app.state.service.run_task(request.scenario)

    @app.post("/api/events/machine-alert")
    def machine_alert(payload: Dict[str, Any]) -> Dict[str, Any]:
        return app.state.service.machine_alert(payload.get("machine_id", "M3"))

    @app.post("/api/events/order-created")
    def order_created(payload: Dict[str, Any]) -> Dict[str, Any]:
        return app.state.service.order_created(payload.get("order_id", "O4"))

    @app.get("/api/state")
    def state() -> Dict[str, Any]:
        latest = app.state.repository.latest_state()
        return latest.model_dump(mode="json") if latest else {}

    @app.get("/api/schedules/latest")
    def schedules_latest() -> Dict[str, Any]:
        latest = app.state.repository.latest_schedule()
        return latest.model_dump(mode="json") if latest else {}

    @app.get("/api/traces/latest")
    def traces_latest() -> Dict[str, Any]:
        latest = app.state.repository.latest_execution()
        return {"agent_traces": [trace.model_dump(mode="json") for trace in latest.agent_traces]} if latest else {"agent_traces": []}

    @app.get("/api/topology/latest")
    def topology_latest() -> Dict[str, Any]:
        latest = app.state.repository.latest_topology()
        return latest.model_dump(mode="json") if latest else {}

    @app.get("/api/events/latest")
    def events_latest() -> Dict[str, Any]:
        return {"events": app.state.repository.latest_events()}

    @app.get("/api/experiments/latest")
    def experiments_latest() -> Dict[str, Any]:
        return app.state.repository.latest_experiment()

    @app.websocket("/ws/dashboard")
    async def dashboard(websocket: WebSocket) -> None:
        await websocket.accept()
        latest_state = app.state.repository.latest_state()
        latest_execution = app.state.repository.latest_execution()
        await websocket.send_json(
            {
                "state": latest_state.model_dump(mode="json") if latest_state else {},
                "execution": latest_execution.model_dump(mode="json") if latest_execution else {},
                "events": app.state.repository.latest_events(),
            }
        )
        await websocket.close()

    return app


app = create_app()
