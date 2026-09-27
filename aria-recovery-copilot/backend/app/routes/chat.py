"""POST /api/chat (spec §8.1) — Server-Sent Events stream, and
POST /api/session/{session_id}/escalation-shown (spec §6.2 banner logging).

Order of operations on every user message (spec §9):
  1. SAFETY FIRST — triage runs before retrieval and before any generation.
  2. Emergency -> fixed safety message + escalation flow; the answer path is
     never invoked.
  3. Otherwise -> retrieve (§8.2); no reliable match -> fixed deferral message,
     no model call.
  4. Otherwise -> stream the grounded answer (§9.4), persist with the exact
     retrieved chunk ids, then send `done` with `sources` (spec §13).

SSE events emitted on this stream:
  event: meta   data: {"message_id": ..., "flagged_emergency": bool}
  event: delta  data: {"text": "..."}            (token-by-token)
  event: done   data: {"message_id","text","flagged_emergency","sources"}
  event: error  data: {"text": "<calm user-facing message>"}

Fail semantics (spec §2 principle 4): any backend error yields one `error`
event with the calm message and closes the stream cleanly — never a stack
trace, never a hang.
"""

from __future__ import annotations

import json
import logging
import uuid

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.answer import (
    EMERGENCY_SAFETY_MESSAGE,
    NO_RELIABLE_MATCH_MESSAGE,
    AnswerRequest,
    sources_from,
    stream_answer,
)
from app.answerer import stream_local_answer
from app.db import StoreUnavailable
from app.escalations import run_escalation
from app.main_client import MainBackendError
from app.retrieval import retrieve
from app.routes.session import get_session_token

logger = logging.getLogger("aria.copilot.chat")

router = APIRouter()

CALM_UNAVAILABLE_MESSAGE = (
    "Copilot is temporarily unavailable. Your dashboard and care plan are unaffected. "
    "Please try again shortly or contact your care team."
)


class ChatRequest(BaseModel):
    session_id: str
    message: str


def sse_event(name: str, payload: dict) -> str:
    return f"event: {name}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/api/chat")
async def chat(body: ChatRequest, request: Request) -> StreamingResponse:
    app_state = request.app.state
    store = app_state.store
    settings = app_state.settings

    convo = await store.get_conversation(body.session_id)
    if convo is None:
        async def unknown_session():
            yield sse_event("error", {"text": "This session has ended. Please return to your ARIA dashboard and open Ask ARIA again."})
        return _sse_response(unknown_session())

    message = (body.message or "").strip()
    if not message:
        async def empty_message():
            yield sse_event("error", {"text": "Type a question and press send."})
        return _sse_response(empty_message())

    async def conversation_stream():
        # Persist the user message; if the store is down we still try to help.
        user_message_id = ""
        try:
            user_message_id = await store.add_message(body.session_id, "user", message)
        except StoreUnavailable:
            logger.error("user message persist failed (store unavailable)")

        # ---- SAFETY GATE (spec §9) — always first ----
        try:
            triage = await app_state.triage.classify(message)
        except Exception:
            # classify() already fail-safes internally; a crash here is a bug —
            # still never let a message reach the answer path untriaged.
            logger.exception("triage crashed — failing safe to emergency")
            from app.safety.triage import TriageResult
            triage = TriageResult(
                emergency=True, stage=None, category="triage_crash_failsafe",
                signal="safety triage crashed — treated as emergency (fail-safe)",
                reason="unexpected triage exception",
            )
        if triage.emergency:
            assistant_message_id = await _safe_add(store, body.session_id, "assistant",
                                                    EMERGENCY_SAFETY_MESSAGE, flagged_emergency=True)
            yield sse_event("meta", {"message_id": assistant_message_id, "flagged_emergency": True})
            yield sse_event("delta", {"text": EMERGENCY_SAFETY_MESSAGE})
            escalation = await run_escalation(
                store=store,
                main_client=app_state.main_client,
                copilot_token=get_session_token(body.session_id),
                patient_id=_patient_id_for(app_state, body.session_id),
                session_id=body.session_id,
                user_message_id=user_message_id or assistant_message_id,
                signal=triage.signal or triage.category or "unclassified emergency signal",
            )
            yield sse_event("done", {
                "message_id": assistant_message_id,
                "text": EMERGENCY_SAFETY_MESSAGE,
                "flagged_emergency": True,
                "sources": [],
                "escalation": {"status": escalation["alert_status"]},
            })
            return

        # ---- Retrieval (spec §8.2) ----
        try:
            history = await store.get_messages(body.session_id, limit=settings.conversation_history_messages)
        except StoreUnavailable:
            history = []
        history = [item for item in history if item.get("id") != user_message_id]

        try:
            retrieval = await retrieve(
                message,
                app_state.embedder,
                app_state.kb,
                top_k=settings.retrieval_top_k,
                threshold=settings.retrieval_threshold,
                embedder_is_lexical=bool(getattr(app_state.embedder, "is_lexical", False)),
            )
        except Exception as error:
            logger.error("retrieval failed: %s", error)
            retrieval = None

        if retrieval is None or not retrieval.reliable:
            # Spec §6.2 empty state: honest deferral instead of guessing.
            assistant_message_id = await _safe_add(store, body.session_id, "assistant", NO_RELIABLE_MATCH_MESSAGE)
            yield sse_event("meta", {"message_id": assistant_message_id, "flagged_emergency": False})
            yield sse_event("delta", {"text": NO_RELIABLE_MATCH_MESSAGE})
            yield sse_event("done", {
                "message_id": assistant_message_id,
                "text": NO_RELIABLE_MATCH_MESSAGE,
                "flagged_emergency": False,
                "sources": [],
            })
            return

        # ---- Grounded answer generation (spec §9.4) ----
        summary = app_state.session_context.get(body.session_id)
        answer_request = AnswerRequest(
            user_message=message,
            conversation_history=history,
            summary=summary,
            retrieval=retrieval,
        )
        message_id = uuid.uuid4().hex
        yield sse_event("meta", {"message_id": message_id, "flagged_emergency": False})

        collected: list[str] = []
        try:
            if app_state.llm is not None:
                answer_stream = stream_answer(
                    answer_request,
                    llm_stream=lambda messages: app_state.llm.stream_chat(messages),
                    max_history=settings.conversation_history_messages,
                )
            else:
                # No LLM configured (no API key): the deterministic extractive
                # path answers from the same retrieved chunks — the Copilot
                # stays useful with zero external API dependencies.
                answer_stream = stream_local_answer(answer_request, embedder=app_state.embedder)
            async for delta in answer_stream:
                collected.append(delta)
                yield sse_event("delta", {"text": delta})
        except Exception as error:
            logger.error("answer generation failed: %s", error)
            if not collected:
                yield sse_event("error", {"text": CALM_UNAVAILABLE_MESSAGE})
            else:
                yield sse_event("done", {
                    "message_id": message_id,
                    "text": "".join(collected),
                    "flagged_emergency": False,
                    "sources": sources_from(retrieval),
                    "partial": True,
                })
            return

        full_text = "".join(collected)
        chunk_ids = [chunk.id for chunk in retrieval.chunks]
        try:
            persisted_id = await store.add_message(
                body.session_id, "assistant", full_text,
                retrieved_chunk_ids=chunk_ids,
            )
            message_id = persisted_id or message_id
        except StoreUnavailable:
            logger.error("assistant message persist failed")

        yield sse_event("done", {
            "message_id": message_id,
            "text": full_text,
            "flagged_emergency": False,
            "sources": sources_from(retrieval),
        })

    return _sse_response(conversation_stream())


async def _safe_add(store, session_id: str, role: str, text: str, **kwargs) -> str:
    try:
        return await store.add_message(session_id, role, text, **kwargs)
    except StoreUnavailable:
        return uuid.uuid4().hex


def _patient_id_for(app_state, session_id: str) -> str:
    """The escalation payload needs the patient id the session was opened
    with. Sessions keep it in memory alongside the token; the conversation
    record only ever stores the hashed id (spec §7)."""
    return app_state.session_patient_ids.get(session_id, "")


def _sse_response(generator):
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# --------------------------------------------------------------------------- #
# Banner-shown logging (spec §6.2: "logs that the banner was shown")
# --------------------------------------------------------------------------- #
class EscalationShownRequest(BaseModel):
    session_id: str


@router.post("/api/session/{session_id}/escalation-shown")
async def escalation_shown(session_id: str, request: Request):
    store = request.app.state.store
    convo = await store.get_conversation(session_id)
    if convo is None:
        return {"ok": False, "error": "unknown session"}
    try:
        await store.add_message(
            session_id, "system_notice",
            "Emergency banner shown to the patient.",
            flagged_emergency=True,
        )
    except StoreUnavailable:
        logger.error("escalation-shown notice persist failed")
    return {"ok": True}
