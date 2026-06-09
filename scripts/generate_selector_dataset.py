from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from swarm.selector.dataset import generate_selector_rows, write_jsonl


def main(path: str = "data/selector_dataset.jsonl") -> None:
    rows = generate_selector_rows(range(8))
    write_jsonl(rows, path)
    print(f"wrote {len(rows)} rows to {path}")


if __name__ == "__main__":
    main()
