from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from swarm.domain.manufacturing import TaskProfile
from swarm.selector.dataset import read_jsonl
from swarm.selector.ml_selector import MLGraphSelector


def main(dataset_path: str = "data/selector_dataset.jsonl", model_path: str = "data/selector_model.joblib") -> None:
    rows = read_jsonl(dataset_path)
    selector = MLGraphSelector.load(model_path)
    correct = 0
    for row in rows:
        profile = TaskProfile(**row["features"])
        if selector.predict(profile).topology_name == row["label"]:
            correct += 1
    accuracy = correct / len(rows) if rows else 0
    print({"rows": len(rows), "accuracy": accuracy})


if __name__ == "__main__":
    main()
