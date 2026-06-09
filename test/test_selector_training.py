from swarm.integrations.huawei import MockModelArtsClient
from swarm.selector.dataset import generate_selector_rows, read_jsonl, write_jsonl
from swarm.selector.ml_selector import MLGraphSelector, ModelArtsLoRAGraphSelectorTrainer


def test_selector_training_pipeline(tmp_path):
    dataset_path = tmp_path / "selector.jsonl"
    model_path = tmp_path / "selector.joblib"
    rows = generate_selector_rows(range(2))
    write_jsonl(rows, str(dataset_path))

    selector = MLGraphSelector().train(read_jsonl(str(dataset_path)))
    selector.save(str(model_path))

    assert model_path.exists()


def test_modelarts_lora_trainer_uses_mock_client():
    trainer = ModelArtsLoRAGraphSelectorTrainer(MockModelArtsClient())

    job = trainer.submit("obs://bucket/dataset.jsonl", "obs://bucket/model")

    assert job["mode"] == "local training"
    assert job["job_id"].startswith("modelarts-mock")
