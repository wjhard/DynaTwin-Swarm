from swarm.optimizer.edge_optimizer.a2c import A2CExperimentRunner


def test_a2c_experiment_runner_returns_history_and_baselines():
    result = A2CExperimentRunner().run(episodes=4)

    assert result["episodes"] == 4
    assert len(result["history"]) == 4
    assert result["top_k"]
    assert any(item["system"] == "GPTSwarm REINFORCE" for item in result["baselines"])
