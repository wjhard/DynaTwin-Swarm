from swarm.integrations.huawei import (
    MockEventGridHandler,
    MockFunctionGraphHandler,
    MockIoTDAClient,
    MockMindIEProvider,
    MockModelArtsClient,
    MockOBSClient,
    MockPanguChatProvider,
)


def test_huawei_mock_clients_run_without_credentials(tmp_path):
    pangu = MockPanguChatProvider().chat([{"role": "user", "content": "hello"}])
    mindie = MockMindIEProvider().chat([{"role": "user", "content": "hello"}])
    obs = MockOBSClient()
    obs.local_root = str(tmp_path)
    obs_result = obs.put_text("reports/test.txt", "ok")
    iot = MockIoTDAClient().publish_device_event({"type": "alert"})
    eventgrid = MockEventGridHandler().route({"type": "alert"})
    functiongraph = MockFunctionGraphHandler().trigger({"type": "alert"})
    modelarts = MockModelArtsClient().submit_lora_training_job("data.jsonl", "model/", {"epochs": 1})

    assert pangu["mode"] == "mock"
    assert mindie["mode"] == "mock"
    assert obs_result["mode"] == "local fallback"
    assert iot["mode"] == "local event bus"
    assert eventgrid["mode"] == "local router"
    assert functiongraph["mode"] == "local trigger"
    assert modelarts["mode"] == "local training"
