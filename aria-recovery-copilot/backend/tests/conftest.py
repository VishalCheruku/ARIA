"""Shared fixtures for the Copilot backend test suite.

Everything injectable is faked here so the full endpoint stack runs offline:
FakeLLM (scriptable), HashEmbeddingClient (deterministic lexical), an
InMemoryKBStore seeded from the real seed content, MemoryConversationStore,
and a MainBackendClient over httpx.MockTransport.
"""

from __future__ import annotations

import json
from typing import Optional

import httpx
import jwt as pyjwt
import pytest
import pytest_asyncio

from app.config import Settings
from app.db import MemoryConversationStore
from app.embeddings import HashEmbeddingClient
from app.kb_store import InMemoryKBStore
from app.main import build_state, create_app
from app.main_client import MainBackendClient
from seed import all_chunks

TEST_SECRET = "test-signing-secret-0123456789abcdef0123456789abcdef"  # 32+ bytes: satisfies RFC 7518 §3.2
TEST_AUD = "aria-copilot"


# --------------------------------------------------------------------------- #
# Fakes
# --------------------------------------------------------------------------- #
class FakeLLM:
    """Scriptable LLM: canned streamed answer + scriptable safety verdicts."""

    model_name = "fake-glm"

    def __init__(self, answer: str = "Your instructions say to rest, walk daily, and call your care team with questions.",
                 verdict: Optional[dict] = None, raise_on_classify: bool = False) -> None:
        self.answer = answer
        self.verdict = verdict
        self.raise_on_classify = raise_on_classify
        self.answer_prompts: list[list[dict]] = []
        self.classified_messages: list[str] = []

    async def stream_chat(self, messages, **_kwargs):
        self.answer_prompts.append(messages)
        for word in self.answer.split(" "):
            yield word + " "

    async def complete(self, messages, **_kwargs):
        if self.raise_on_classify:
            raise RuntimeError("simulated provider outage")
        if isinstance(self.verdict, Exception):
            raise self.verdict
        return json.dumps(self.verdict or {"emergency": False, "reason": "no emergency"})

    async def classify_emergency(self, message: str) -> dict:
        self.classified_messages.append(message)
        if self.raise_on_classify:
            raise RuntimeError("simulated provider outage")
        if isinstance(self.verdict, Exception):
            raise self.verdict
        return self.verdict or {"emergency": False, "reason": "no emergency"}


def make_settings(**overrides) -> Settings:
    base = dict(
        zai_api_key="test-key",
        zai_base_url="http://llm.test",
        zai_model="fake-glm",
        embedding_provider="hash",
        mongodb_uri="mongodb://localhost:59999",
        copilot_signing_secret=TEST_SECRET,
        copilot_token_audience=TEST_AUD,
        main_backend_url="http://main.test",
        retrieval_threshold=0.72,
        triage_stage2_enabled=True,
    )
    base.update(overrides)
    return Settings(**base)


def make_patient_token(patient_id: str = "p1", expired: bool = False) -> str:
    import time

    now = int(time.time())
    payload = {
        "sub": patient_id,
        "aud": TEST_AUD,
        "iat": now - 600 if expired else now,
        "exp": now - 60 if expired else now + 300,
    }
    return pyjwt.encode(payload, TEST_SECRET, algorithm="HS256")


# --------------------------------------------------------------------------- #
# Mock main backend (the two boundary calls: context-summary + alerts)
# --------------------------------------------------------------------------- #
class MockMainBackend:
    def __init__(self) -> None:
        self.alert_posts: list[dict] = []
        self.context_calls: list[str] = []
        self.fail_context = False
        self.context_payload = {
            "first_name": "Asha",
            "risk_tier": "High",
            "primary_diagnosis": "Heart failure, diabetes",
            "medications": ["Aspirin 75mg daily", "Pantoprazole 40mg daily"],
            "discharge_date": "2026-09-20",
            "known_restrictions": ["No lifting heavier than 2 kg for 2 weeks", "Low salt diet"],
        }

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/context-summary") and request.method == "GET":
            patient_id = path.split("/")[-2]
            self.context_calls.append(patient_id)
            if self.fail_context:
                return httpx.Response(500, json={"error": "boom"})
            if patient_id == "unknown":
                return httpx.Response(404, json={"error": "not found"})
            return httpx.Response(200, json=self.context_payload)
        if path == "/api/alerts" and request.method == "POST":
            self.alert_posts.append(json.loads(request.content.decode("utf-8")))
            return httpx.Response(201, json={"ok": True, "alert_id": "alert-123"})
        return httpx.Response(404, json={"error": "no route"})

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self.handler)


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #
@pytest.fixture()
def embedder() -> HashEmbeddingClient:
    return HashEmbeddingClient(dimensions=256)


@pytest_asyncio.fixture()
async def kb(embedder: HashEmbeddingClient) -> InMemoryKBStore:
    from app.embeddings import embed_text_for_record

    records = all_chunks()
    # The lexical embedder is fitted on exactly the texts that get embedded,
    # mirroring what scripts/seed_kb.py does for the Mongo path.
    composite_texts = [embed_text_for_record(record, lexical=True) for record in records]
    await embedder.fit_records(composite_texts)
    vectors = await embedder.embed(composite_texts)
    for record, vector in zip(records, vectors):
        record.embedding_model = embedder.name
        record.embedding_dim = embedder.dimensions
        record.embedding = vector
    # The lexical dev embedder pairs with BM25 ranking in the in-memory store
    # (cosine over bag-of-words vectors dilutes short queries against long
    # chunks); production uses semantic vectors + Atlas Vector Search.
    return InMemoryKBStore(records, scoring="bm25")


@pytest.fixture()
def mock_main() -> MockMainBackend:
    return MockMainBackend()


@pytest.fixture()
def main_client(mock_main: MockMainBackend) -> MainBackendClient:
    return MainBackendClient(
        "http://main.test",
        transport=mock_main.transport(),
        cache_ttl_seconds=900.0,
    )


@pytest.fixture()
def store() -> MemoryConversationStore:
    return MemoryConversationStore()


@pytest.fixture()
def fake_llm() -> FakeLLM:
    return FakeLLM()


@pytest_asyncio.fixture()
async def app(store, kb, embedder, fake_llm, main_client):
    settings = make_settings()
    application = create_app(settings)
    await build_state(application, settings, overrides={
        "store": store,
        "kb": kb,
        "embedder": embedder,
        "llm": fake_llm,
        "main_client": main_client,
    })
    yield application


@pytest_asyncio.fixture()
async def client(app):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://copilot.test") as async_client:
        yield async_client


async def start_session(client: httpx.AsyncClient, patient_id: str = "p1") -> dict:
    response = await client.post("/api/session/start", json={"token": make_patient_token(patient_id)})
    assert response.status_code == 200, response.text
    return response.json()


def parse_sse(text: str) -> list[tuple[str, Optional[dict]]]:
    events = []
    for block in text.split("\n\n"):
        if not block.strip():
            continue
        name = None
        data = None
        for line in block.split("\n"):
            if line.startswith("event:"):
                name = line[len("event:"):].strip()
            elif line.startswith("data:"):
                data = line[len("data:"):].strip()
        events.append((name, json.loads(data) if data else None))
    return events
