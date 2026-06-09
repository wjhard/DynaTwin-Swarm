from swarm.selector.dataset import FEATURE_NAMES, generate_selector_rows, read_jsonl, write_jsonl


def test_selector_dataset_generation_and_jsonl_roundtrip(tmp_path):
    rows = generate_selector_rows(range(2))
    path = tmp_path / "selector_dataset.jsonl"
    write_jsonl(rows, str(path))
    loaded = read_jsonl(str(path))

    assert len(loaded) == 12
    assert set(FEATURE_NAMES) <= set(loaded[0]["features"])
    assert loaded[0]["label"] in {"serial_chain", "parallel_fusion", "supervisor_tree", "high_risk_review"}
