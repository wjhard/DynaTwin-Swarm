from swarm.domain.manufacturing import FactorySimulator
from swarm.selector.dataset import generate_selector_rows
from swarm.selector.ml_selector import MLGraphSelector


def test_ml_graph_selector_train_predict_save_load(tmp_path):
    rows = generate_selector_rows(range(3))
    model_path = tmp_path / "selector.joblib"
    selector = MLGraphSelector().train(rows)
    selector.save(str(model_path))

    simulator = FactorySimulator()
    profile = simulator.profile_task(simulator.scenario("main"))
    loaded = MLGraphSelector.load(str(model_path))
    selection = loaded.predict(profile)

    assert selection.topology_name in {"serial_chain", "parallel_fusion", "supervisor_tree", "high_risk_review"}
    assert selection.confidence >= 0


def test_ml_graph_selector_falls_back_without_model():
    simulator = FactorySimulator()
    profile = simulator.profile_task(simulator.scenario("normal"))

    selection = MLGraphSelector().predict(profile)

    assert selection.topology_name == "serial_chain"
    assert selection.selector_name.endswith("fallback")
