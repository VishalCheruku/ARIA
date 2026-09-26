"""RAG answer generation (spec §9.4).

The system prompt below is used VERBATIM from the spec (placeholders filled).
The answer path is only ever reached when Stage 1 + Stage 2 both said "not an
emergency" — the safety layer gates this module, never the reverse.

Grounding rules enforced here:
  - retrieved chunks are numbered in the prompt so claims are traceable
  - if nothing reliable was retrieved, the fixed no-match message is returned
    and NO model call happens at all
  - `sources` returned to the frontend lists the exact chunks that grounded
    the answer (spec §13)
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import AsyncIterator, Optional, Sequence

from app.main_client import ContextSummary
from app.retrieval import RetrievalResult

logger = logging.getLogger("aria.copilot.answer")

NO_RELIABLE_MATCH_MESSAGE = (
    "I don't have reliable information on that from your care instructions — "
    "please check with your care team."
)

# Spec §9.3 step 3 — fixed, never model-generated.
EMERGENCY_SAFETY_MESSAGE = (
    "This sounds like it could be urgent. Please contact your care team or "
    "emergency services right now. I've also notified your care team."
)

ANSWER_SYSTEM_PROMPT = """You are the ARIA Recovery Copilot, a supportive assistant for a patient \
recovering after hospital discharge. You are talking to {first_name}, whose \
primary diagnosis is {primary_diagnosis} and current risk tier is \
{risk_tier}.

Ground rules:
1. Answer ONLY using the information in the RETRIEVED CONTEXT below. If the \
retrieved context does not clearly answer the question, say so plainly \
and suggest the patient check with their care team — do not guess, and \
do not use general medical knowledge outside the provided context.
2. Never give a specific dosage, drug interaction ruling, or diagnosis. \
You may restate what the retrieved context says about the patient's own \
listed medications and known restrictions, but do not extrapolate to \
drugs or situations not covered in the context.
3. Keep answers short (3-6 sentences), warm, plain-language, and specific \
to what was asked.
4. If the patient's message is emotional (anxious, scared, frustrated) \
rather than purely factual, acknowledge that briefly before answering \
the factual part.
5. Never claim certainty you don't have. Prefer "your discharge \
instructions say..." over "you should...".

RETRIEVED CONTEXT:
{retrieved_chunks}

PATIENT'S OWN RECORD (for reference only, do not repeat verbatim unless \
asked):
- Medications: {medications}
- Known restrictions: {known_restrictions}
- Discharge date: {discharge_date}

Conversation so far:
{conversation_history}

Patient's new message: {user_message}"""


@dataclass
class AnswerRequest:
    user_message: str
    conversation_history: Sequence[dict]  # [{role, text}]
    summary: Optional[ContextSummary]
    retrieval: RetrievalResult


def format_chunks(retrieval: RetrievalResult) -> str:
    if not retrieval.chunks:
        return "(none)"
    lines = []
    for index, chunk in enumerate(retrieval.chunks, start=1):
        lines.append(f"[{index}] {chunk.source_title} (category: {chunk.category})\n{chunk.text}")
    return "\n\n".join(lines)


def format_history(history: Sequence[dict], max_messages: int = 8) -> str:
    recent = list(history)[-max_messages:]
    if not recent:
        return "(this is the first message)"
    return "\n".join(f"{'Patient' if item.get('role') == 'user' else 'Copilot'}: {item.get('text', '')}" for item in recent)


def build_answer_messages(request: AnswerRequest) -> list[dict]:
    summary = request.summary or ContextSummary()
    system_prompt = ANSWER_SYSTEM_PROMPT.format(
        first_name=summary.first_name or "the patient",
        primary_diagnosis=summary.primary_diagnosis or "not on file",
        risk_tier=summary.risk_tier or "not classified",
        retrieved_chunks=format_chunks(request.retrieval),
        medications=", ".join(summary.medications) if summary.medications else "none on file",
        known_restrictions="; ".join(summary.known_restrictions) if summary.known_restrictions else "none on file",
        discharge_date=summary.discharge_date or "not on file",
        conversation_history=format_history(request.conversation_history),
        user_message=request.user_message,
    )
    return [{"role": "system", "content": system_prompt}]


def sources_from(retrieval: RetrievalResult) -> list[dict]:
    seen: set[str] = set()
    sources = []
    for chunk in retrieval.chunks:
        key = f"{chunk.source_title}|{chunk.category}"
        if key in seen:
            continue
        seen.add(key)
        sources.append({"source_title": chunk.source_title, "category": chunk.category, "chunk_id": chunk.id})
    return sources


async def stream_answer(
    request: AnswerRequest,
    llm_stream,  # async callable: messages -> AsyncIterator[str]
    max_history: int = 8,
) -> AsyncIterator[str]:
    """Yield answer text deltas. Caller persists the final message."""
    messages = build_answer_messages(request)
    started = time.monotonic()
    async for delta in llm_stream(messages):
        yield delta
    logger.info("answer streamed in %.2fs (chunks=%d)", time.monotonic() - started, len(request.retrieval.chunks))
