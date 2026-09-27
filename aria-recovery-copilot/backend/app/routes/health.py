"""GET /api/health (spec §8.1) — plain liveness check, no auth.

Used by the deploy platform and by nothing in the main app. Exposes no PHI.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request

logger = logging.getLogger("aria.copilot.health")

router = APIRouter()


@router.get("/api/health")
async def health(request: Request) -> dict:
    state = request.app.state
    kb_count = 0
    kb_error = ""
    try:
        kb_count = await state.kb.count()
    except Exception as error:  # store down must not fail liveness
        kb_error = str(error)[:200]

    llm = getattr(state, "llm", None)
    return {
        "status": "ok",
        "service": "aria-recovery-copilot",
        "module": "isolated (separate process, deploy, database)",
        "database_connected": bool(getattr(state, "db_connected", False)),
        "kb_chunks": kb_count,
        "kb_error": kb_error,
        "embedding_provider": getattr(state.embedder, "name", "unconfigured"),
        "answer_mode": "llm" if llm is not None else "local-extractive",
        "llm_model": getattr(state, "llm_model_name", "unconfigured"),
        "triage_stage2_enabled": bool(getattr(state, "triage_stage2_enabled", False)),
        "main_backend_circuit": state.main_client.breaker.state,
    }
