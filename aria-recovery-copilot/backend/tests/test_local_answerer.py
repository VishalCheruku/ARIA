"""The no-API-key path (spec §2 principle 4 + §9.4).

With no LLM configured the Copilot must still answer grounded questions: the
local extractive answerer composes replies from the SAME retrieval pipeline,
every factual sentence verbatim from a retrieved chunk. These tests pin the
grounding contract and the endpoint behavior end-to-end.
"""

import re

import httpx
import pytest
import pytest_asyncio

from app.answer import AnswerRequest, NO_RELIABLE_MATCH_MESSAGE
from app.answerer import _split_units, stream_local_answer
from app.kb_store import ChunkResult
from app.main import build_state, create_app
from app.main_client import ContextSummary
from app.retrieval import RetrievalResult
from tests.conftest import make_settings, parse_sse, start_session


def make_chunk(category: str, title: str, text: str) -> ChunkResult:
    return ChunkResult(id=title, source_title=title, source_type="guideline",
                       category=category, text=text, tags=[], score=0.5)


def make_request(question: str, chunks: list[ChunkResult], summary=None) -> AnswerRequest:
    return AnswerRequest(
        user_message=question,
        conversation_history=[],
        summary=summary,
        retrieval=RetrievalResult(chunks=chunks, best_score=0.5, used_categories=None, reliable=True),
    )


WOUND_CHUNK = make_chunk("wound", "Caring for your incision", (
    "Keep the incision clean and dry for the first 7 days. "
    "Do not drive for at least 2 weeks after your procedure. "
    "Watch for redness, swelling, or discharge around the wound."
))
DIET_CHUNK = make_chunk("diet", "Eating after surgery", (
    "Eat small, frequent meals during the first week. "
    "Avoid salty foods because they increase swelling."
))


# --------------------------------------------------------------------------- #
# Unit extraction
# --------------------------------------------------------------------------- #
def test_split_units_bullets_and_headings():
    text = (
        "Wound care:\n"
        "- Keep the incision clean and dry for 7 days.\n"
        "1. No driving for 2 weeks.\n"
        "Yes.\n"
        "Watch for redness or swelling."
    )
    units = _split_units(text)
    assert units[0] == "Wound care: Keep the incision clean and dry for 7 days."
    # The heading prefixes only the unit directly after it — repeating it on
    # every bullet would be noise.
    assert units[1] == "No driving for 2 weeks."
    # The lone "Yes." fragment folds into the next unit instead of standing alone.
    assert units[2] == "Yes. Watch for redness or swelling."


# --------------------------------------------------------------------------- #
# Grounding contract: factual sentences come verbatim from retrieved chunks
# --------------------------------------------------------------------------- #
_TEMPLATE_PREFIXES = (
    "Here is what", "Your care team's guidance", "Your discharge instructions say this about",
    "That sounds", "I hear you", "If you notice", "If the wound looks", "If anything here",
    "I don't have", "Asha",
)


def _factual_sentences(answer: str) -> list[str]:
    parts = [part.strip() for part in re.split(r"(?<=[.:!?])\s+", answer) if part.strip()]
    return [
        part for part in parts
        if not part.startswith(_TEMPLATE_PREFIXES) and part.rstrip(":").strip()
    ]


def test_reply_is_fully_extractive():
    request = make_request("When can I drive again?", [WOUND_CHUNK, DIET_CHUNK])
    async def _collect():
        return [delta async for delta in stream_local_answer(request)]
    import asyncio
    answer = "".join(asyncio.run(_collect()))

    assert "Do not drive for at least 2 weeks after your procedure." in answer
    for sentence in _factual_sentences(answer):
        assert any(sentence in chunk.text for chunk in (WOUND_CHUNK, DIET_CHUNK)), sentence


def test_relevant_sentences_rank_above_filler():
    request = make_request("What should I eat during recovery?", [DIET_CHUNK, WOUND_CHUNK])
    async def _collect():
        return [delta async for delta in stream_local_answer(request)]
    import asyncio
    answer = "".join(asyncio.run(_collect()))
    assert "Eat small, frequent meals during the first week." in answer


def test_emotional_message_gets_acknowledged_first():
    request = make_request("I am really worried about my wound, it looks scary", [WOUND_CHUNK])
    async def _collect():
        return [delta async for delta in stream_local_answer(request)]
    import asyncio
    answer = "".join(asyncio.run(_collect()))
    assert answer.startswith(("That sounds", "I hear you"))


def test_ack_uses_patient_name_when_known():
    summary = ContextSummary(first_name="Asha")
    request = make_request("I am anxious about my incision", [WOUND_CHUNK], summary=summary)
    async def _collect():
        return [delta async for delta in stream_local_answer(request)]
    import asyncio
    answer = "".join(asyncio.run(_collect()))
    assert answer.startswith("Asha, ")


def test_degenerate_chunks_stay_calm_and_nonempty():
    empty_chunk = make_chunk("faq", "Nothing", "...")
    request = make_request("hello?", [empty_chunk])
    async def _collect():
        return [delta async for delta in stream_local_answer(request)]
    import asyncio
    answer = "".join(asyncio.run(_collect()))
    assert "care team" in answer


# --------------------------------------------------------------------------- #
# Endpoint behavior with no LLM configured
# --------------------------------------------------------------------------- #
@pytest_asyncio.fixture()
async def no_llm_app(store, kb, embedder, main_client):
    settings = make_settings(zai_api_key="")  # construction raises -> llm None
    application = create_app(settings)
    await build_state(application, settings, overrides={
        "store": store,
        "kb": kb,
        "embedder": embedder,
        "main_client": main_client,
    })
    assert application.state.llm is None
    yield application


@pytest_asyncio.fixture()
async def no_llm_client(no_llm_app):
    transport = httpx.ASGITransport(app=no_llm_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://copilot.test") as async_client:
        yield async_client


async def test_health_reports_local_answer_mode(no_llm_client):
    body = (await no_llm_client.get("/api/health")).json()
    assert body["answer_mode"] == "local-extractive"
    assert body["llm_model"] == "local-extractive-rag"
    assert body["triage_stage2_enabled"] is False


async def test_chat_without_llm_answers_locally_with_sources(no_llm_client):
    session = await start_session(no_llm_client)
    response = await no_llm_client.post("/api/chat", json={
        "session_id": session["session_id"],
        "message": "What should I eat after my surgery?",
    })
    assert response.status_code == 200
    events = parse_sse(response.text)
    names = [name for name, _ in events]
    assert names[0] == "meta"
    assert names[-1] == "done"

    deltas = "".join(payload["text"] for name, payload in events if name == "delta")
    done = events[-1][1]
    assert deltas == done["text"], "deltas must concatenate into the persisted answer"
    assert "temporarily unavailable" not in done["text"].lower()
    assert done["text"] != NO_RELIABLE_MATCH_MESSAGE
    assert done["sources"], "local answers cite the same sources payload (spec §13)"
    assert all("source_title" in source and "category" in source for source in done["sources"])


async def test_chat_without_llm_still_defers_on_off_scope(no_llm_client):
    session = await start_session(no_llm_client)
    response = await no_llm_client.post("/api/chat", json={
        "session_id": session["session_id"],
        "message": "What is the capital of France?",
    })
    done = parse_sse(response.text)[-1][1]
    assert done["text"] == NO_RELIABLE_MATCH_MESSAGE
    assert done["sources"] == []


async def test_chat_without_llm_emergency_path_intact(no_llm_client):
    session = await start_session(no_llm_client)
    response = await no_llm_client.post("/api/chat", json={
        "session_id": session["session_id"],
        "message": "I have crushing chest pain right now",
    })
    events = parse_sse(response.text)
    meta = next(payload for name, payload in events if name == "meta")
    assert meta["flagged_emergency"] is True
    done = events[-1][1]
    assert done["flagged_emergency"] is True
    assert "urgent" in done["text"].lower()
