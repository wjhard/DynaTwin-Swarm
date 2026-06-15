from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import Body, FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.service import DynaTwinService
from swarm.integrations.huawei import HuaweiIntegrationConfig
from swarm.llm.industrial_provider import provider_runtime_status
from swarm.persistence import SQLiteRepository


class RunTaskRequest(BaseModel):
    scenario: str = "main"


def create_app(repository=None) -> FastAPI:
    repo = repository or SQLiteRepository(os.getenv("SQLITE_PATH", "./data/dynatwin.db"))
    service = DynaTwinService(repo, provider=os.getenv("LLM_PROVIDER", "mock"))
    app = FastAPI(title="DynaTwin-Swarm API")
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=os.getenv("CORS_ALLOW_ORIGIN_REGEX", r"http://(localhost|127\.0\.0\.1):\d+"),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.repository = repo
    app.state.service = service

    @app.get("/health")
    def health() -> Dict[str, Any]:
        return {"status": "ok", "mode": os.getenv("APP_ENV", "local")}

    @app.post("/api/tasks/run")
    def run_task(request: RunTaskRequest) -> Dict[str, Any]:
        return app.state.service.run_task(request.scenario)

    @app.get("/api/datasets/public")
    def public_datasets() -> Dict[str, Any]:
        return app.state.service.public_datasets()

    @app.post("/api/datasets/public/{dataset_id}/run")
    def run_public_dataset(dataset_id: str) -> Dict[str, Any]:
        return app.state.service.run_public_dataset(dataset_id)

    @app.post("/api/events/machine-alert")
    def machine_alert(payload: Dict[str, Any]) -> Dict[str, Any]:
        return app.state.service.machine_alert(payload.get("machine_id", "M3"))

    @app.post("/api/events/order-created")
    def order_created(payload: Dict[str, Any]) -> Dict[str, Any]:
        return app.state.service.order_created(payload.get("order_id", "O4"))

    @app.post("/api/demo/reset")
    def reset_demo() -> Dict[str, Any]:
        return app.state.service.reset_demo()

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

    @app.get("/api/integrations/status")
    def integrations_status() -> Dict[str, Any]:
        status = HuaweiIntegrationConfig.from_env().status()
        for name, runtime_state in provider_runtime_status().items():
            if runtime_state:
                status[name] = runtime_state
        return {"status": status}

    @app.get("/api/experiments/latest")
    def experiments_latest() -> Dict[str, Any]:
        return app.state.repository.latest_experiment()

    @app.post("/api/experiments/run_a2c")
    def run_a2c_experiment() -> Dict[str, Any]:
        return app.state.service.run_a2c_experiment()

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

    @app.get("/api/factory/oee")
    def factory_oee() -> Dict[str, Any]:
        return app.state.service.get_oee()

    @app.get("/api/logs/agent")
    def agent_logs() -> Dict[str, Any]:
        return {"logs": app.state.service.get_agent_logs()}

    @app.get("/api/events/history")
    def events_history() -> Dict[str, Any]:
        return {"events": app.state.service.get_event_history()}

    @app.post("/api/simulation/tick")
    def simulation_tick(payload: Dict[str, Any] | None = Body(default=None)) -> Dict[str, Any]:
        payload = payload or {}
        return app.state.service.auto_tick(force_reschedule=bool(payload.get("force_reschedule", False)))

    @app.post("/api/simulation/scenario")
    def simulation_scenario(payload: Dict[str, Any] | None = Body(default=None)) -> Dict[str, Any]:
        payload = payload or {}
        try:
            return app.state.service.run_simulation_scenario(str(payload.get("scenario", "random_failure")))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return app


app = create_app()
