from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, List

import httpx


@dataclass
class PanguChatProvider:
    base_url: str = ""
    api_key: str = ""
    auth_mode: str = "bearer"
    model: str = ""
    temperature: float = 0.2
    max_tokens: int = 600
    timeout: float = 20.0

    @classmethod
    def from_env(cls) -> "PanguChatProvider":
        return cls(
            base_url=os.getenv("PANGU_BASE_URL", ""),
            api_key=os.getenv("PANGU_API_KEY", ""),
            auth_mode=os.getenv("PANGU_AUTH_MODE", "bearer"),
            model=os.getenv("PANGU_MODEL", ""),
            temperature=float(os.getenv("PANGU_TEMPERATURE", "0.2")),
            max_tokens=int(os.getenv("PANGU_MAX_TOKENS", "600")),
            timeout=float(os.getenv("PANGU_TIMEOUT", "20")),
        )

    @property
    def connected(self) -> bool:
        return bool(self.base_url and self.api_key)

    def chat(self, messages: List[Dict[str, str]]) -> Dict[str, object]:
        if not self.connected:
            return {"connected": False, "mode": "mock", "content": "PanguLM mock response; credentials not configured."}
        payload: Dict[str, Any] = {
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }
        if self.model:
            payload["model"] = self.model
        response = httpx.post(
            self.base_url,
            headers=self._headers(),
            json=payload,
            timeout=self.timeout,
        )
        response.raise_for_status()
        body = response.json()
        return {"connected": True, "mode": "connected", "content": self._extract_content(body), "raw": body}

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.auth_mode == "apig":
            headers["X-Apig-AppCode"] = self.api_key
        elif self.auth_mode == "token":
            headers["X-Auth-Token"] = self.api_key
        else:
            headers["Authorization"] = self.api_key if self.api_key.lower().startswith("bearer ") else f"Bearer {self.api_key}"
        return headers

    def _extract_content(self, body: Any) -> str:
        if isinstance(body, str):
            return body
        if not isinstance(body, dict):
            return str(body)
        choices = body.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0]
            if isinstance(first, dict):
                message = first.get("message")
                if isinstance(message, dict) and message.get("content"):
                    return str(message["content"])
                if first.get("text"):
                    return str(first["text"])
                delta = first.get("delta")
                if isinstance(delta, dict) and delta.get("content"):
                    return str(delta["content"])
        for key in ("content", "answer", "result", "generated_text", "output_text"):
            value = body.get(key)
            if value:
                return str(value)
        return str(body)


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
