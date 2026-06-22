from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, List

import httpx


DEFAULT_DOUBAO_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"


@dataclass
class DoubaoChatProvider:
    """OpenAI-compatible chat adapter for ByteDance Doubao through Volcano Ark."""

    base_url: str = DEFAULT_DOUBAO_BASE_URL
    api_key: str = ""
    model: str = ""
    temperature: float = 0.2
    max_tokens: int = 600
    timeout: float = 20.0

    @classmethod
    def from_env(cls) -> "DoubaoChatProvider":
        return cls(
            base_url=os.getenv("DOUBAO_BASE_URL", DEFAULT_DOUBAO_BASE_URL),
            api_key=os.getenv("DOUBAO_API_KEY", os.getenv("ARK_API_KEY", "")),
            model=os.getenv("DOUBAO_MODEL", os.getenv("ARK_MODEL", "")),
            temperature=float(os.getenv("DOUBAO_TEMPERATURE", "0.2")),
            max_tokens=int(os.getenv("DOUBAO_MAX_TOKENS", "600")),
            timeout=float(os.getenv("DOUBAO_TIMEOUT", "20")),
        )

    @property
    def connected(self) -> bool:
        return bool(self.api_key and self.model)

    def chat(self, messages: List[Dict[str, str]]) -> Dict[str, object]:
        if not self.connected:
            return {
                "connected": False,
                "mode": "mock",
                "content": "Doubao mock response; DOUBAO_API_KEY/ARK_API_KEY or DOUBAO_MODEL is not configured.",
            }
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }
        response = httpx.post(
            self._chat_completions_url(),
            headers=self._headers(),
            json=payload,
            timeout=self.timeout,
        )
        response.raise_for_status()
        body = response.json()
        return {"connected": True, "mode": "connected", "content": self._extract_content(body), "raw": body}

    def _chat_completions_url(self) -> str:
        base = self.base_url.rstrip("/")
        if base.endswith("/chat/completions"):
            return base
        return f"{base}/chat/completions"

    def _headers(self) -> Dict[str, str]:
        token = self.api_key if self.api_key.lower().startswith("bearer ") else f"Bearer {self.api_key}"
        return {"Content-Type": "application/json", "Authorization": token}

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
                delta = first.get("delta")
                if isinstance(delta, dict) and delta.get("content"):
                    return str(delta["content"])
                if first.get("text"):
                    return str(first["text"])
        for key in ("content", "answer", "result", "generated_text", "output_text"):
            value = body.get(key)
            if value:
                return str(value)
        return str(body)


class MockDoubaoChatProvider(DoubaoChatProvider):
    def __init__(self) -> None:
        super().__init__(base_url=DEFAULT_DOUBAO_BASE_URL, api_key="", model="")
