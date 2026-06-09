from __future__ import annotations

from swarm.persistence.repository import GaussDBRepository as _GaussDBRepository


class GaussDBRepository(_GaussDBRepository):
    pass


class MockGaussDBRepository(_GaussDBRepository):
    def __init__(self, fallback_path: str = "./data/dynatwin.db") -> None:
        super().__init__(dsn="", fallback_path=fallback_path)
