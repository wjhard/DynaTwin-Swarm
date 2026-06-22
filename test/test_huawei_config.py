from swarm.integrations.huawei import HuaweiIntegrationConfig


def test_huawei_config_defaults_to_local_mock(monkeypatch):
    for key in [
        "PANGU_BASE_URL",
        "PANGU_API_KEY",
        "DOUBAO_API_KEY",
        "DOUBAO_MODEL",
        "ARK_API_KEY",
        "ARK_MODEL",
        "MINDIE_BASE_URL",
        "GAUSSDB_DSN",
        "OBS_BUCKET",
        "IOTDA_ENDPOINT",
        "EVENTGRID_ENDPOINT",
        "FUNCTIONGRAPH_ENDPOINT",
        "MODELARTS_ENDPOINT",
    ]:
        monkeypatch.delenv(key, raising=False)

    config = HuaweiIntegrationConfig.from_env()
    status = config.status()

    assert status["PanguLM"] == "mock"
    assert status["Doubao"] == "mock"
    assert status["MindIE"] == "mock"
    assert status["GaussDB"] == "sqlite fallback"
    assert status["ModelArts"] == "local training"


def test_huawei_config_marks_pangu_as_configured(monkeypatch):
    monkeypatch.setenv("PANGU_BASE_URL", "https://example.com/pangu")
    monkeypatch.setenv("PANGU_API_KEY", "test-key")

    status = HuaweiIntegrationConfig.from_env().status()

    assert status["PanguLM"] == "configured"


def test_huawei_config_marks_doubao_as_configured(monkeypatch):
    monkeypatch.setenv("DOUBAO_API_KEY", "test-key")
    monkeypatch.setenv("DOUBAO_MODEL", "doubao-test-endpoint")

    status = HuaweiIntegrationConfig.from_env().status()

    assert status["Doubao"] == "configured"
