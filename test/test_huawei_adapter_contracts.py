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


def test_gaussdb_repository_falls_back_to_sqlite(tmp_path):
    repo = GaussDBRepository(dsn="", fallback_path=str(tmp_path / "gaussdb_mock.db"))

    assert repo.provider == "gaussdb_mock"
    assert repo.latest_state() is None
