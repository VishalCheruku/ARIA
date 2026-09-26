"""Escalation flow (spec §9.3) — the exact ordered sequence:

1. Do NOT call the normal answer-generation path.   (enforced in routes/chat)
2. Return `flagged_emergency: true` immediately.    (routes/chat)
3. Reply with the fixed safety message.             (routes/chat, from answer.py)
4. Write an `escalations` record.                   (here)
5. Call POST /api/alerts on the main backend.       (here)
6. Log the event with the detected signal category — never raw message text.

Step 5 failures are logged loudly but never fail the patient-facing response:
the patient already has the safety message; the escalation record keeps
`main_app_alert_id` empty so the miss is reviewable and can be replayed.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.db import ConversationStore, StoreUnavailable
from app.main_client import MainBackendClient, MainBackendError

logger = logging.getLogger("aria.copilot.escalation")


async def run_escalation(
    *,
    store: ConversationStore,
    main_client: MainBackendClient,
    copilot_token: str,
    patient_id: str,
    session_id: str,
    user_message_id: str,
    signal: str,
) -> dict:
    """Execute steps 4-6. Returns a summary for logging/SSE meta."""
    alert_id = ""
    alert_status = "not_sent"

    # Step 4: escalation record first (local source of truth survives main-app
    # outages), with the signal category, NOT the raw message text.
    try:
        await store.record_escalation(session_id, user_message_id, signal, "")
    except StoreUnavailable:
        logger.error("escalation record could not be persisted (store unavailable)")

    # Step 5: notify the main backend through the existing alerts pipeline.
    payload = {
        "patient_id": patient_id,
        "source": "copilot",
        "severity": "high",
        "reason": "Patient described symptoms matching an emergency pattern during a Copilot chat.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "detected_signal": signal,
        "conversation_id": session_id,
    }
    try:
        alert_id = await main_client.post_alert(payload, copilot_token)
        alert_status = "sent" if alert_id else "sent_no_id"
        if alert_id:
            try:
                await store.record_escalation(session_id, user_message_id, signal, alert_id)
            except StoreUnavailable:
                logger.error("escalation alert-id backfill failed")
    except MainBackendError as error:
        # Step 5 failure must never block the fixed safety message the patient
        # already received — log loud for later review/replay.
        logger.error("ALERT POST TO MAIN BACKEND FAILED (escalation may need replay): %s", error)
        alert_status = "failed"
    except Exception as error:  # pragma: no cover - defensive
        logger.exception("unexpected error posting alert: %s", error)
        alert_status = "failed"

    # Mark the conversation so the UI keeps the persistent banner.
    try:
        await store.mark_escalated(session_id)
    except StoreUnavailable:
        logger.error("conversation escalation flag update failed")

    logger.warning("ESCALATION conversation=%s signal=%s alert_status=%s alert_id=%s",
                   session_id, signal, alert_status, alert_id or "-")
    return {"alert_id": alert_id, "alert_status": alert_status}
