from __future__ import annotations

import json
import sqlite3
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional

from swarm.domain.manufacturing.models import ExecutionRecord, FactoryState, SchedulePlan, TopologySelection


class Repository(ABC):
    @abstractmethod
    def save_state(self, state: FactoryState) -> None:
        pass

    @abstractmethod
    def latest_state(self) -> Optional[FactoryState]:
        pass

    @abstractmethod
    def save_schedule(self, plan: SchedulePlan) -> None:
        pass

    @abstractmethod
    def latest_schedule(self) -> Optional[SchedulePlan]:
        pass

    @abstractmethod
    def save_execution(self, record: ExecutionRecord) -> None:
        pass

    @abstractmethod
    def latest_execution(self) -> Optional[ExecutionRecord]:
        pass

    @abstractmethod
    def save_topology(self, selection: TopologySelection) -> None:
        pass

    @abstractmethod
    def latest_topology(self) -> Optional[TopologySelection]:
        pass

    @abstractmethod
    def add_event(self, event: Dict[str, Any]) -> None:
        pass

    @abstractmethod
    def latest_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def save_experiment(self, experiment: Dict[str, Any]) -> None:
        pass

    @abstractmethod
    def latest_experiment(self) -> Dict[str, Any]:
        pass


class SQLiteRepository(Repository):
    def __init__(self, db_path: str = "./data/dynatwin.db") -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self) -> None:
        with self._connect() as conn:
            for table in ["states", "schedules", "executions", "topologies", "events", "experiments"]:
                conn.execute(
                    f"CREATE TABLE IF NOT EXISTS {table} "
                    "(id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
                )

    def _insert(self, table: str, payload: Dict[str, Any] | str) -> None:
        text = payload if isinstance(payload, str) else json.dumps(payload)
        with self._connect() as conn:
            conn.execute(f"INSERT INTO {table} (payload) VALUES (?)", (text,))

    def _latest(self, table: str) -> Optional[str]:
        with self._connect() as conn:
            row = conn.execute(f"SELECT payload FROM {table} ORDER BY id DESC LIMIT 1").fetchone()
        return row[0] if row else None

    def _latest_many(self, table: str, limit: int) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(f"SELECT payload FROM {table} ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        return [json.loads(row[0]) for row in rows]

    def save_state(self, state: FactoryState) -> None:
        self._insert("states", state.model_dump_json())

    def latest_state(self) -> Optional[FactoryState]:
        payload = self._latest("states")
        return FactoryState.model_validate_json(payload) if payload else None

    def save_schedule(self, plan: SchedulePlan) -> None:
        self._insert("schedules", plan.model_dump_json())

    def latest_schedule(self) -> Optional[SchedulePlan]:
        payload = self._latest("schedules")
        return SchedulePlan.model_validate_json(payload) if payload else None

    def save_execution(self, record: ExecutionRecord) -> None:
        self._insert("executions", record.model_dump_json())

    def latest_execution(self) -> Optional[ExecutionRecord]:
        payload = self._latest("executions")
        return ExecutionRecord.model_validate_json(payload) if payload else None

    def save_topology(self, selection: TopologySelection) -> None:
        self._insert("topologies", selection.model_dump_json())

    def latest_topology(self) -> Optional[TopologySelection]:
        payload = self._latest("topologies")
        return TopologySelection.model_validate_json(payload) if payload else None

    def add_event(self, event: Dict[str, Any]) -> None:
        self._insert("events", event)

    def latest_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        return self._latest_many("events", limit)

    def save_experiment(self, experiment: Dict[str, Any]) -> None:
        self._insert("experiments", experiment)

    def latest_experiment(self) -> Dict[str, Any]:
        payload = self._latest("experiments")
        return json.loads(payload) if payload else {}


class GaussDBRepository(SQLiteRepository):
    provider = "gaussdb_mock"

    def __init__(self, dsn: str = "", fallback_path: str = "./data/dynatwin.db") -> None:
        self.dsn = dsn
        super().__init__(fallback_path)
