from pathlib import Path
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from swarm.optimizer.edge_optimizer.a2c import A2CExperimentRunner


def main(path: str = "data/topk_graphs.json") -> None:
    runner = A2CExperimentRunner()
    runner.run(episodes=15)
    runner.optimizer.store.save(path)
    print(f"exported {len(runner.optimizer.store.top())} graphs to {path}")


if __name__ == "__main__":
    main()
