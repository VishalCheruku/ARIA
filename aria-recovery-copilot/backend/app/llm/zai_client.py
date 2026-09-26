"""GLM-5.3-flash client via the Z.ai API (spec §5).

OpenAI-compatible HTTP surface:
  POST {base}/chat/completions   (stream=true for token streaming)
  POST {base}/embeddings         (see embeddings.py)

Design constraints from the spec:
  - The safety classifier (§9.2) is a SEPARATE call from answer generation, so
    the safety check never depends on the generation path.
  - Fail loud to logs, fail quiet to the user: everything here raises
    LLMError; the route layer converts that into the calm unavailable message.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncIterator, Iterable

import httpx

from app.safety.triage import SAFETY_CLASSIFIER_PROMPT, parse_classifier_json

logger = logging.getLogger("aria.copilot.llm")


class LLMError(RuntimeError):
    """Any failure talking to the model provider."""


class ZaiClient:
    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        timeout_seconds: float = 30.0,
        max_output_tokens: int = 500,
    ) -> None:
        if not api_key:
            # Config error, not a transient failure — raise at construction.
            raise LLMError("ZAI_API_KEY is not configured")
        self._client = httpx.AsyncClient(
            base_url=base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(timeout_seconds, connect=5.0),
        )
        self._model = model
        self._max_output_tokens = max_output_tokens

    async def aclose(self) -> None:
        await self._client.aclose()

    # ------------------------------------------------------------------ #
    # Answer generation (streaming)
    # ------------------------------------------------------------------ #
    async def stream_chat(
        self,
        messages: Iterable[dict],
        *,
        temperature: float = 0.3,
        max_tokens: int | None = None,
    ) -> AsyncIterator[str]:
        payload = {
            "model": self._model,
            "messages": list(messages),
            "stream": True,
            "temperature": temperature,
            "max_tokens": max_tokens or self._max_output_tokens,
        }
        async for delta in self._stream_response(payload):
            yield delta

    async def _stream_response(self, payload: dict) -> AsyncIterator[str]:
        last_error: Exception | None = None
        for attempt in range(2):  # one transparent retry on transient failures
            try:
                async with self._client.stream("POST", "/chat/completions", json=payload) as response:
                    if response.status_code >= 400:
                        body = (await response.aread()).decode("utf-8", "replace")
                        raise LLMError(f"chat/completions failed: HTTP {response.status_code}: {body[:300]}")
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if data in ("", "[DONE]"):
                            continue
                        try:
                            chunk = json.loads(data)
                        except json.JSONDecodeError:
                            continue
                        choices = chunk.get("choices") or []
                        if not choices:
                            continue
                        delta = (choices[0].get("delta") or {}).get("content")
                        if delta:
                            yield delta
                return
            except (httpx.HTTPError, LLMError) as error:
                last_error = error
                logger.warning("LLM stream attempt %d failed: %s", attempt + 1, error)
                await asyncio.sleep(0.4 * (attempt + 1))
        raise LLMError(f"LLM streaming failed after retries: {last_error}")

    # ------------------------------------------------------------------ #
    # One-shot completion (used by the safety classifier)
    # ------------------------------------------------------------------ #
    async def complete(self, messages: list[dict], *, temperature: float = 0.0, max_tokens: int = 200) -> str:
        payload = {
            "model": self._model,
            "messages": messages,
            "stream": False,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        last_error: Exception | None = None
        for attempt in range(2):
            try:
                response = await self._client.post("/chat/completions", json=payload)
                response.raise_for_status()
                data = response.json()
                content = (data.get("choices") or [{}])[0].get("message", {}).get("content")
                if not content:
                    raise LLMError("chat/completions returned an empty message")
                return content
            except (httpx.HTTPError, LLMError, KeyError, ValueError) as error:
                last_error = error
                logger.warning("LLM completion attempt %d failed: %s", attempt + 1, error)
                await asyncio.sleep(0.4 * (attempt + 1))
        raise LLMError(f"LLM completion failed after retries: {last_error}")

    # ------------------------------------------------------------------ #
    # Spec §9.2 — the dedicated, narrow safety classification call
    # ------------------------------------------------------------------ #
    async def classify_emergency(self, message: str) -> dict:
        raw = await self.complete(
            [
                {"role": "system", "content": SAFETY_CLASSIFIER_PROMPT},
                {"role": "user", "content": message},
            ],
            temperature=0.0,
            max_tokens=120,
        )
        return parse_classifier_json(raw)
