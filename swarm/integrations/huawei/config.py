from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Dict


@dataclass(frozen=True)
class HuaweiIntegrationConfig:
    app_env: str = "local"
    llm_provider: str = "mock"
    database_provider: str = "sqlite"
    event_provider: str = "local"
    object_storage_provider: str = "local"
    training_provider: str = "local"
    pangu_base_url: str = ""
    pangu_api_key: str = ""
    mindie_base_url: str = ""
    gaussdb_dsn: str = ""
    obs_bucket: str = ""
    iotda_endpoint: str = ""
    eventgrid_endpoint: str = ""
    functiongraph_endpoint: str = ""
    modelarts_endpoint: str = ""

    @classmethod
    def from_env(cls) -> "HuaweiIntegrationConfig":
        return cls(
            app_env=os.getenv("APP_ENV", "local"),
            llm_provider=os.getenv("LLM_PROVIDER", "mock"),
            database_provider=os.getenv("DATABASE_PROVIDER", "sqlite"),
            event_provider=os.getenv("EVENT_PROVIDER", "local"),
            object_storage_provider=os.getenv("OBJECT_STORAGE_PROVIDER", "local"),
            training_provider=os.getenv("TRAINING_PROVIDER", "local"),
            pangu_base_url=os.getenv("PANGU_BASE_URL", ""),
            pangu_api_key=os.getenv("PANGU_API_KEY", ""),
            mindie_base_url=os.getenv("MINDIE_BASE_URL", ""),
            gaussdb_dsn=os.getenv("GAUSSDB_DSN", ""),
            obs_bucket=os.getenv("OBS_BUCKET", ""),
            iotda_endpoint=os.getenv("IOTDA_ENDPOINT", ""),
            eventgrid_endpoint=os.getenv("EVENTGRID_ENDPOINT", ""),
            functiongraph_endpoint=os.getenv("FUNCTIONGRAPH_ENDPOINT", ""),
            modelarts_endpoint=os.getenv("MODELARTS_ENDPOINT", ""),
        )

    def status(self) -> Dict[str, str]:
        return {
            "PanguLM": "connected" if self.pangu_base_url and self.pangu_api_key else "mock",
            "MindIE": "connected" if self.mindie_base_url else "mock",
            "GaussDB": "connected" if self.gaussdb_dsn and self.database_provider == "gaussdb" else "sqlite fallback",
            "OBS": "connected" if self.obs_bucket and self.object_storage_provider == "obs" else "local fallback",
            "IoTDA": "connected" if self.iotda_endpoint and self.event_provider == "iotda" else "local event bus",
            "EventGrid": "connected" if self.eventgrid_endpoint else "local router",
            "FunctionGraph": "connected" if self.functiongraph_endpoint else "local trigger",
            "ModelArts": "connected" if self.modelarts_endpoint and self.training_provider == "modelarts" else "local training",
        }
