from pathlib import Path
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from swarm.optimizer.edge_optimizer.a2c import A2CExperimentRunner


def main(path: str = "reports/experiments/a2c_summary.json") -> None:
    result = A2CExperimentRunner().run(episodes=15)
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(f"wrote A2C summary to {path}")


if __name__ == "__main__":
    main()
