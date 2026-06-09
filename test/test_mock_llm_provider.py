from swarm.domain.manufacturing import FactorySimulator
from swarm.llm.industrial_provider import get_industrial_provider


def test_mock_and_external_provider_fallbacks_are_deterministic(monkeypatch):
    simulator = FactorySimulator()
    state = simulator.scenario("main")
    profile = simulator.profile_task(state)

    monkeypatch.delenv("PANGU_API_KEY", raising=False)
    monkeypatch.delenv("PANGU_BASE_URL", raising=False)
    monkeypatch.delenv("MINDIE_BASE_URL", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    providers = [
        get_industrial_provider("mock"),
        get_industrial_provider("pangu"),
        get_industrial_provider("mindie"),
        get_industrial_provider("openai_optional"),
    ]

    outputs = [provider.complete("Agent", state, profile, {}) for provider in providers]

    assert "mock decision" in outputs[0]
    assert "Pangu mock fallback" in outputs[1]
    assert "MindIE mock fallback" in outputs[2]
    assert "OpenAI optional mock fallback" in outputs[3]
