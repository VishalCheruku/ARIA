"""POST /api/session/start (spec §8.1).

Flow: verify patient token -> open a conversation -> fetch the patient's
minimal context summary from the main backend ONCE (cached for the session;
falls back to the last-known-good cache or a generic greeting when the main
backend is degraded, spec §4.3) -> return the greeting.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.db import Conversation, ConversationStore, StoreUnavailable
from app.main_client import ContextSummary, MainBackendError, wait_for
from app.security import TokenError, verify_patient_token

logger = logging.getLogger("aria.copilot.session")

router = APIRouter()

GENERIC_GREETING = (
    "Hello, I can help answer questions about your recovery. What's on your mind?"
)

# In-memory session->token cache. The raw token lives ONLY here (never in the
# database) and is required for the two main-backend calls later in the
# session. Process restart loses it: the session degrades gracefully.
_session_tokens: dict[str, str] = {}


def get_store(request: Request) -> ConversationStore:
    return request.app.state.store


def get_settings_dep(request: Request):
    return request.app.state.settings


class SessionStartRequest(BaseModel):
    token: str


class SessionStartResponse(BaseModel):
    session_id: str
    patient_first_name: str
    risk_tier: str
    greeting: str
    degraded: bool = False


def greeting_for(summary: ContextSummary) -> str:
    if summary.first_name:
        # Spec §8.1 response shape, verbatim template.
        return f"Hi {summary.first_name}, I can help answer questions about your recovery. What's on your mind?"
    return GENERIC_GREETING


@router.post("/api/session/start", response_model=SessionStartResponse)
async def session_start(body: SessionStartRequest, request: Request) -> SessionStartResponse:
    settings = request.app.state.settings
    store: ConversationStore = request.app.state.store
    main_client = request.app.state.main_client

    try:
        patient_id = verify_patient_token(body.token, settings)
    except TokenError as error:
        raise TokenHTTP(error) from error

    try:
        convo: Conversation = await store.create_conversation(patient_id)
    except StoreUnavailable as error:
        raise UnavailableHTTP(error) from error

    _session_tokens[convo.session_id] = body.token

    summary: ContextSummary | None = None
    degraded = False
    try:
        summary = await wait_for(
            main_client.get_context_summary(patient_id, body.token),
            timeout=settings.session_context_timeout_seconds,
            label="context-summary",
        )
    except MainBackendError as error:
        # Spec §11.3: a timing-out context-summary must degrade to a generic
        # greeting, never hang the session.
        logger.warning("session start degraded (no patient context): %s", error)
        degraded = True
    except Exception:  # pragma: no cover - defensive
        logger.exception("unexpected context-summary failure")
        degraded = True

    # Session-level caches: the minimal summary for the answer prompt, and the
    # patient id for the escalation alert payload (in memory only, spec §7).
    request.app.state.session_context[convo.session_id] = summary
    request.app.state.session_patient_ids[convo.session_id] = patient_id

    return SessionStartResponse(
        session_id=convo.session_id,
        patient_first_name=summary.first_name if summary else "",
        risk_tier=summary.risk_tier if summary else "",
        greeting=greeting_for(summary) if summary else GENERIC_GREETING,
        degraded=degraded or bool(summary and summary.degraded),
    )


def get_session_token(session_id: str) -> str:
    return _session_tokens.get(session_id, "")


class TokenHTTP(HTTPException):
    def __init__(self, error: TokenError) -> None:
        super().__init__(status_code=401, detail=str(error))


class UnavailableHTTP(HTTPException):
    def __init__(self, error: StoreUnavailable) -> None:
        super().__init__(
            status_code=503,
            detail="Copilot is temporarily unavailable. Your dashboard and care plan are unaffected.",
        )
