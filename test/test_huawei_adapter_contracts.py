from swarm.integrations.huawei import (
    GaussDBRepository,
    MindIEChatProvider,
    ModelArtsClient,
    PanguChatProvider,
)


def test_providers_do_not_claim_connection_without_configuration():
    assert PanguChatProvider().chat([])["connected"] is False
    assert MindIEChatProvider().chat([])["connected"] is False
    assert ModelArtsClient().submit_lora_training_job("dataset", "out", {})["connected"] is False


def test_pangu_provider_performs_configured_http_request(monkeypatch):
    captured = {}

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": "盘古模型真实响应"}}]}

    def fake_post(url, headers, json, timeout):
        captured.update({"url": url, "headers": headers, "json": json, "timeout": timeout})
        return Response()

    monkeypatch.setattr("swarm.integrations.huawei.providers.httpx.post", fake_post)

    result = PanguChatProvider(
        base_url="https://example.com/pangu",
        api_key="app-code",
        auth_mode="apig",
        model="pangu-test",
    ).chat([{"role": "user", "content": "hello"}])

    assert result["connected"] is True
    assert result["mode"] == "connected"
    assert result["content"] == "盘古模型真实响应"
    assert captured["url"] == "https://example.com/pangu"
    assert captured["headers"]["X-Apig-AppCode"] == "app-code"
    assert captured["json"]["model"] == "pangu-test"


def test_gaussdb_repository_falls_back_to_sqlite(tmp_path):
    repo = GaussDBRepository(dsn="", fallback_path=str(tmp_path / "gaussdb_mock.db"))

    assert repo.provider == "gaussdb_mock"
    assert repo.latest_state() is None
