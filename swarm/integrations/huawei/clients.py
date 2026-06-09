from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List


@dataclass
class OBSClient:
    bucket: str = ""
    local_root: str = "./data/objects"

    @property
    def connected(self) -> bool:
        return bool(self.bucket)

    def put_text(self, key: str, text: str) -> Dict[str, Any]:
        if not self.connected:
            path = Path(self.local_root) / key
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
            return {"connected": False, "mode": "local fallback", "path": str(path)}
        return {"connected": True, "mode": "connected", "bucket": self.bucket, "key": key}


class MockOBSClient(OBSClient):
    def __init__(self) -> None:
        super().__init__(bucket="")


@dataclass
class IoTDAClient:
    endpoint: str = ""
    events: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def connected(self) -> bool:
        return bool(self.endpoint)

    def publish_device_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        self.events.append(event)
        return {"connected": self.connected, "mode": "connected" if self.connected else "local event bus", "event": event}


class MockIoTDAClient(IoTDAClient):
    def __init__(self) -> None:
        super().__init__(endpoint="")


@dataclass
class EventGridHandler:
    endpoint: str = ""
    routed_events: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def connected(self) -> bool:
        return bool(self.endpoint)

    def route(self, event: Dict[str, Any]) -> Dict[str, Any]:
        self.routed_events.append(event)
        return {"connected": self.connected, "mode": "connected" if self.connected else "local router", "event": event}


class MockEventGridHandler(EventGridHandler):
    def __init__(self) -> None:
        super().__init__(endpoint="")


@dataclass
class FunctionGraphHandler:
    endpoint: str = ""

    @property
    def connected(self) -> bool:
        return bool(self.endpoint)

    def trigger(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {"connected": self.connected, "mode": "connected" if self.connected else "local trigger", "payload": payload}


class MockFunctionGraphHandler(FunctionGraphHandler):
    def __init__(self) -> None:
        super().__init__(endpoint="")


@dataclass
class ModelArtsClient:
    endpoint: str = ""
    jobs: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def connected(self) -> bool:
        return bool(self.endpoint)

    def submit_lora_training_job(self, dataset_uri: str, output_uri: str, params: Dict[str, Any]) -> Dict[str, Any]:
        job = {
            "job_id": f"modelarts-mock-{len(self.jobs) + 1}",
            "dataset_uri": dataset_uri,
            "output_uri": output_uri,
            "params": params,
            "connected": self.connected,
            "mode": "connected" if self.connected else "local training",
        }
        self.jobs.append(job)
        return job


class MockModelArtsClient(ModelArtsClient):
    def __init__(self) -> None:
        super().__init__(endpoint="")
