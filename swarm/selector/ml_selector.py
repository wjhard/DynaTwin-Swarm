from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import joblib

from swarm.domain.manufacturing.models import TaskProfile, TopologySelection
from swarm.integrations.huawei import ModelArtsClient
from swarm.selector.dataset import FEATURE_NAMES
from swarm.selector.graph_selector import RuleBasedGraphSelector
from swarm.selector.topology import TopologyRegistry


def encode_features(features: Dict[str, object]) -> List[float]:
    task_types = [
        "normal_scheduling",
        "multi_resource_conflict",
        "machine_failure",
        "inventory_shortage",
        "high_risk_composite_incident",
        "complex_composite_incident",
    ]
    risk_levels = ["low", "medium", "high", "critical"]
    values: List[float] = []
    values.extend([1.0 if features.get("task_type") == task_type else 0.0 for task_type in task_types])
    values.extend([1.0 if features.get("risk_level") == risk_level else 0.0 for risk_level in risk_levels])
    for name in FEATURE_NAMES[2:]:
        value = features.get(name)
        values.append(float(value) if not isinstance(value, bool) else float(value))
    return values


class MLGraphSelector:
    name = "ml_graph_selector"

    def __init__(self, model=None, fallback: Optional[RuleBasedGraphSelector] = None) -> None:
        self.model = model
        self.fallback = fallback or RuleBasedGraphSelector()

    def train(self, rows: List[Dict[str, object]]) -> "MLGraphSelector":
        from sklearn.ensemble import RandomForestClassifier

        x = [encode_features(row["features"]) for row in rows]
        y = [row["label"] for row in rows]
        self.model = RandomForestClassifier(n_estimators=50, random_state=42)
        self.model.fit(x, y)
        return self

    def predict(self, profile: TaskProfile) -> TopologySelection:
        if self.model is None:
            fallback = self.fallback.select(profile)
            fallback.selector_name = self.name + "_fallback"
            return fallback
        features = encode_features(profile.feature_dict())
        label = self.model.predict([features])[0]
        confidence = 0.75
        if hasattr(self.model, "predict_proba"):
            probabilities = self.model.predict_proba([features])[0]
            confidence = float(max(probabilities))
        return TopologySelection(
            task_id=profile.task_id,
            topology_name=str(label),
            selector_name=self.name,
            confidence=confidence,
            candidates=TopologyRegistry.names(),
            reason="predicted by trainable graph selector",
        )

    def save(self, path: str) -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.model, path)

    @classmethod
    def load(cls, path: str) -> "MLGraphSelector":
        return cls(model=joblib.load(path))


@dataclass
class ModelArtsLoRAGraphSelectorTrainer:
    client: ModelArtsClient

    def submit(self, dataset_uri: str, output_uri: str, params: Optional[Dict[str, object]] = None) -> Dict[str, object]:
        return self.client.submit_lora_training_job(dataset_uri, output_uri, params or {"method": "lora", "target": "graph_selector"})
