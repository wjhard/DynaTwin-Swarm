from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from swarm.selector.dataset import read_jsonl
from swarm.selector.ml_selector import MLGraphSelector


def main(dataset_path: str = "data/selector_dataset.jsonl", model_path: str = "data/selector_model.joblib") -> None:
    rows = read_jsonl(dataset_path)
    selector = MLGraphSelector().train(rows)
    selector.save(model_path)
    print(f"trained selector on {len(rows)} rows; saved {model_path}")


if __name__ == "__main__":
    main()
