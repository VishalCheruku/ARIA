"""Endpoint tests for the Copilot backend (spec §8.1) plus the §11.3
degradation check: a timing-out/failing context-summary must produce a
generic greeting, never a hang."""

import json

import httpx
import pytest

from app.answer import EMERGENCY_SAFETY_MESSAGE, NO_RELIABLE_MATCH_MESSAGE
from tests.conftest import FakeLLM, make_patient_token, parse_sse, start_session


async def test_health_no_auth(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["kb_chunks"] >= 60
    assert "detail" not in body


async def test_session_start_returns_greeting_and_context(client, mock_main):
    data = await start_session(client)
    assert data["session_id"]
    assert data["patient_first_name"] == "Asha"
    assert data["risk_tier"] == "High"
    assert data["greeting"] == "Hi Asha, I can help answer questions about your recovery. What's on your mind?"
    # The copilot called the main backend's read endpoint exactly once.
    assert mock_main.context_calls == ["p1"]


async def test_session_start_rejects_expired_token(client):
    response = await client.post("/api/session/start", json={"token": make_patient_token(expired=True)})
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


async def test_session_start_rejects_tampered_token(client):
    token = make_patient_token()[:-4] + "AAAA"
    response = await client.post("/api/session/start", json={"token": token})
    assert response.status_code == 401


async def test_chat_streams_grounded_answer_with_sources(client, fake_llm, store):
    session = await start_session(client)
    response = await client.post("/api/chat", json={
        "session_id": session["session_id"],
        "message": "What should I eat after my surgery?",
    })
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    events = parse_sse(response.text)
    names = [name for name, _ in events]

    assert names[0] == "meta"
    assert events[0][1]["flagged_emergency"] is False
    assert "delta" in names
    assert names[-1] == "done"
    done_payload = events[-1][1]
    assert done_payload["sources"], "grounded answer must cite sources (spec §13)"
    assert all("source_title" in source and "category" in source for source in done_payload["sources"])

    # The answer prompt contained the retrieved chunks and the patient record.
    prompt = fake_llm.answer_prompts[0][0]["content"]
    assert "RETRIEVED CONTEXT:" in prompt
    assert "Asha" in prompt

    # Conversation persisted with both messages.
    messages = await store.get_messages(session["session_id"])
    roles = [m["role"] for m in messages]
    assert roles == ["user", "assistant"]


async def test_chat_emergency_bypasses_answer_path_and_posts_alert(client, fake_llm, store, mock_main):
    session = await start_session(client)
    alert_posts_before = len(mock_main.alert_posts)
    response = await client.post("/api/chat", json={
        "session_id": session["session_id"],
        "message": "I have crushing chest pain right now",
    })
    events = parse_sse(response.text)
    names = [name for name, _ in events]
    assert "meta" in names
    meta = next(payload for name, payload in events if name == "meta")
    assert meta["flagged_emergency"] is True

    # The fixed safety message is streamed verbatim, and the model was NEVER
    # asked to generate an answer (spec §9.3 steps 1-3).
    deltas = "".join(payload["text"] for name, payload in events if name == "delta")
    assert deltas == EMERGENCY_SAFETY_MESSAGE
    assert fake_llm.answer_prompts == []

    done = events[-1][1]
    assert done["flagged_emergency"] is True
    assert done["sources"] == []

    # Escalation: record + main-backend alert POST (spec §9.3 steps 4-5).
    assert len(mock_main.alert_posts) == alert_posts_before + 1
    alert = mock_main.alert_posts[-1]
    assert alert["source"] == "copilot"
    assert alert["severity"] == "high"
    assert alert["patient_id"] == "p1"
    convo = await store.get_conversation(session["session_id"])
    assert convo.escalated is True


async def test_chat_no_reliable_match_defers_without_model(client, fake_llm):
    session = await start_session(client)
    response = await client.post("/api/chat", json={
        "session_id": session["session_id"],
        "message": "What is the capital of France?",
    })
    events = parse_sse(response.text)
    done = events[-1][1]
    assert done["text"].startswith(NO_RELIABLE_MATCH_MESSAGE)
    assert done["sources"] == []
    assert fake_llm.answer_prompts == []


async def test_chat_unknown_session_returns_calm_error(client):
    response = await client.post("/api/chat", json={"session_id": "nope", "message": "hello"})
    events = parse_sse(response.text)
    assert events[0][0] == "error"
    assert "dashboard" in events[0][1]["text"].lower()


async def test_session_start_degrades_gracefully_when_main_backend_down(client, mock_main):
    mock_main.fail_context = True
    data = await start_session(client)
    assert data["session_id"]
    assert data["patient_first_name"] == ""
    assert data["degraded"] is True
    assert data["greeting"].startswith("Hello")  # generic greeting (spec §11.3)


async def test_circuit_opens_after_repeated_main_backend_failures_then_recovers(client, app, mock_main):
    mock_main.fail_context = True
    for _ in range(3):  # threshold
        await client.post("/api/session/start", json={"token": make_patient_token("p1")})
    assert mock_main.context_calls == ["p1", "p1", "p1"]
    # breaker is now open: a 4th session start must NOT hit the main backend
    await client.post("/api/session/start", json={"token": make_patient_token("p1")})
    assert mock_main.context_calls == ["p1", "p1", "p1"]
    mock_main.fail_context = False
    # ...and once the breaker half-opens and succeeds, traffic resumes
    app.state.main_client.breaker._opened_at -= 31  # age past reset window
    data = await start_session(client)
    assert data["patient_first_name"] == "Asha"


async def test_escalation_shown_is_logged(client, store):
    session = await start_session(client)
    response = await client.post(f"/api/session/{session['session_id']}/escalation-shown")
    assert response.status_code == 200
    assert response.json()["ok"] is True
    messages = await store.get_messages(session["session_id"])
    assert any(m["role"] == "system_notice" and "banner" in m["text"].lower() for m in messages)


async def test_escalation_shown_unknown_session(client):
    response = await client.post("/api/session/does-not-exist/escalation-shown")
    assert response.status_code == 200
    assert response.json()["ok"] is False
