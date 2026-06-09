from __future__ import annotations

import json
import sqlite3
from abc import ABC, abstractmethod
from pathlib import Path
from typing import List, Optional

from swarm.domain.manufacturing.models import ExecutionRecord, FactoryState, SchedulePlan


class FactoryStateStore(ABC):
    @abstractmethod
    def save_state(self, state: FactoryState) -> None:
        pass

    @abstractmethod
    def load_latest_state(self) -> Optional[FactoryState]:
        pass

    @abstractmethod
    def save_schedule(self, plan: SchedulePlan) -> None:
        pass

    @abstractmethod
    def load_latest_schedule(self) -> Optional[SchedulePlan]:
        pass

    @abstractmethod
    def save_execution(self, record: ExecutionRecord) -> None:
        pass

    @abstractmethod
    def load_latest_execution(self) -> Optional[ExecutionRecord]:
        pass


class InMemoryFactoryStateStore(FactoryStateStore):
    def __init__(self) -> None:
        self.states: List[FactoryState] = []
        self.schedules: List[SchedulePlan] = []
        self.executions: List[ExecutionRecord] = []

    def save_state(self, state: FactoryState) -> None:
        self.states.append(state.model_copy(deep=True))

    def load_latest_state(self) -> Optional[FactoryState]:
        return self.states[-1].model_copy(deep=True) if self.states else None

    def save_schedule(self, plan: SchedulePlan) -> None:
        self.schedules.append(plan.model_copy(deep=True))

    def load_latest_schedule(self) -> Optional[SchedulePlan]:
        return self.schedules[-1].model_copy(deep=True) if self.schedules else None

    def save_execution(self, record: ExecutionRecord) -> None:
        self.executions.append(record.model_copy(deep=True))

    def load_latest_execution(self) -> Optional[ExecutionRecord]:
        return self.executions[-1].model_copy(deep=True) if self.executions else None


class SQLiteFactoryStateStore(FactoryStateStore):
    def __init__(self, db_path: str = "./data/dynatwin.db") -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS factory_states "
                "(id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
            )
            conn.execute(
                "CREATE TABLE IF NOT EXISTS schedules "
                "(id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
            )
            conn.execute(
                "CREATE TABLE IF NOT EXISTS executions "
                "(id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
            )

    def _save_payload(self, table: str, payload: str) -> None:
        with self._connect() as conn:
            conn.execute(f"INSERT INTO {table} (payload) VALUES (?)", (payload,))

    def _load_payload(self, table: str) -> Optional[str]:
        with self._connect() as conn:
            row = conn.execute(f"SELECT payload FROM {table} ORDER BY id DESC LIMIT 1").fetchone()
        return row[0] if row else None

    def save_state(self, state: FactoryState) -> None:
        self._save_payload("factory_states", state.model_dump_json())

    def load_latest_state(self) -> Optional[FactoryState]:
        payload = self._load_payload("factory_states")
        return FactoryState.model_validate_json(payload) if payload else None

    def save_schedule(self, plan: SchedulePlan) -> None:
        self._save_payload("schedules", plan.model_dump_json())

    def load_latest_schedule(self) -> Optional[SchedulePlan]:
        payload = self._load_payload("schedules")
        return SchedulePlan.model_validate_json(payload) if payload else None

    def save_execution(self, record: ExecutionRecord) -> None:
        self._save_payload("executions", record.model_dump_json())

    def load_latest_execution(self) -> Optional[ExecutionRecord]:
        payload = self._load_payload("executions")
        return ExecutionRecord.model_validate_json(payload) if payload else None
