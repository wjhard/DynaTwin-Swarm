from swarm.integrations.doubao import DoubaoChatProvider


def test_doubao_provider_uses_openai_compatible_chat_completion(monkeypatch):
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": "豆包调度建议"}}]}

    def fake_post(url, headers, json, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setattr("swarm.integrations.doubao.providers.httpx.post", fake_post)

    provider = DoubaoChatProvider(
        base_url="https://ark.cn-beijing.volces.com/api/v3",
        api_key="test-key",
        model="doubao-test-endpoint",
        timeout=3,
    )
    result = provider.chat([{"role": "user", "content": "生成决策"}])

    assert captured["url"] == "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["json"]["model"] == "doubao-test-endpoint"
    assert captured["json"]["messages"][0]["content"] == "生成决策"
    assert captured["timeout"] == 3
    assert result["connected"] is True
    assert result["content"] == "豆包调度建议"


def test_doubao_provider_stays_mock_without_credentials():
    provider = DoubaoChatProvider(api_key="", model="")

    result = provider.chat([{"role": "user", "content": "生成决策"}])

    assert result["connected"] is False
    assert result["mode"] == "mock"
    assert "Doubao mock response" in result["content"]
