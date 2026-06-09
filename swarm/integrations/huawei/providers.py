from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

import httpx


@dataclass
class PanguChatProvider:
    base_url: str = ""
    api_key: str = ""
    timeout: float = 10.0

    @property
    def connected(self) -> bool:
        return bool(self.base_url and self.api_key)

    def chat(self, messages: List[Dict[str, str]]) -> Dict[str, object]:
        if not self.connected:
            return {"connected": False, "mode": "mock", "content": "PanguLM mock response; credentials not configured."}
        response = httpx.post(
            self.base_url,
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={"messages": messages},
            timeout=self.timeout,
        )
        response.raise_for_status()
        return {"connected": True, "mode": "connected", "content": response.json()}


class MockPanguChatProvider(PanguChatProvider):
    def __init__(self) -> None:
        super().__init__(base_url="", api_key="")


@dataclass
class MindIEChatProvider:
    base_url: str = ""
    timeout: float = 10.0

    @property
    def connected(self) -> bool:
        return bool(self.base_url)

    def chat(self, messages: List[Dict[str, str]]) -> Dict[str, object]:
        if not self.connected:
            return {"connected": False, "mode": "mock", "content": "MindIE mock response; endpoint not configured."}
        response = httpx.post(self.base_url, json={"messages": messages}, timeout=self.timeout)
        response.raise_for_status()
        return {"connected": True, "mode": "connected", "content": response.json()}


class MockMindIEProvider(MindIEChatProvider):
    def __init__(self) -> None:
        super().__init__(base_url="")
