"""Local grounded answer generation — the Copilot's no-API-key RAG path.

The model-based answer path (app.answer.stream_answer) requires a configured
LLM. When none is configured (no ZAI_API_KEY), the Copilot must still answer:
returning "temporarily unavailable" on every grounded question would break the
product (spec §2 principle 4: degrade, never dead-end). This module is that
fallback: a deterministic, EXTRACTIVE answer composer running over the SAME
retrieval + safety pipeline as the model path.

Grounding contract (strictly stronger than model generation):
  - every factual sentence in the reply appears VERBATIM in a retrieved chunk
  - the template layer (emotional ack, lead-in, closing) adds no facts
  - the `done` SSE event still carries the same `sources` payload, so the UI's
    source list keeps working unchanged

Streaming contract: an async iterator of text deltas with the same shape as
the model path — routes/chat.py fans either path into `delta` events.
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass
from typing import AsyncIterator, Sequence

from app.answer import AnswerRequest
from app.embeddings import _content_tokens
from app.kb_store import ChunkResult
from app.retrieval import RetrievalResult

logger = logging.getLogger("aria.copilot.answerer")

MAX_SENTENCES = 5
MAX_ANSWER_CHARS = 900
_DUPLICATE_JACCARD = 0.6

# --------------------------------------------------------------------------- #
# Sentence-unit extraction
# --------------------------------------------------------------------------- #
_LEADING_BULLET_RE = re.compile(r"^\s*(?:[•‣◦\-*–—]|\d+[.)])\s+")
_SENTENCE_BOUNDARY_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])")


def _split_units(text: str) -> list[str]:
    """Split one chunk into answer-able sentence units.

    Discharge instructions are mostly bullet lists, so each bullet/numbered
    line is its own unit; prose splits at sentence boundaries. A heading line
    ending in ':' (and any too-short fragment) is folded into the unit that
    follows it, so a heading or a fragment never stands alone as an "answer".
    """
    units: list[str] = []
    pending_prefix = ""
    for raw_line in (text or "").splitlines():
        line = _LEADING_BULLET_RE.sub("", raw_line.strip())
        if not line:
            continue
        for sentence in _SENTENCE_BOUNDARY_RE.split(line):
            sentence = sentence.strip()
            if not sentence:
                continue
            if sentence.endswith(":") or len(sentence.split()) < 2:
                pending_prefix = (pending_prefix + " " + sentence).strip()
                continue
            units.append(f"{pending_prefix} {sentence}".strip() if pending_prefix else sentence)
            pending_prefix = ""
    # A trailing heading with no content after it is dropped with the pending prefix.
    return units


@dataclass
class _Unit:
    text: str
    chunk_rank: int
    index: int
    tokens: frozenset[str]
    score: float = 0.0


def _build_units(chunks: Sequence[ChunkResult], idf: dict[str, float], query_tokens: list[str]) -> list[_Unit]:
    units: list[_Unit] = []
    for rank, chunk in enumerate(chunks):
        for index, text in enumerate(_split_units(chunk.text)):
            tokens = frozenset(_content_tokens(text))
            units.append(_Unit(text=text, chunk_rank=rank, index=index, tokens=tokens))
    _score_units(units, query_tokens, idf)
    return units


# --------------------------------------------------------------------------- #
# Relevance scoring — IDF-weighted coverage of the query's term mass
# --------------------------------------------------------------------------- #
def _idf_table(embedder) -> dict[str, float]:
    """Reuse the lexical embedder's fitted IDF when present (same statistics
    that shaped retrieval); any other embedder yields an empty table and every
    term scores uniformly."""
    return getattr(embedder, "_idf", None) or {}


def _score_units(units: list[_Unit], query_tokens: list[str], idf: dict[str, float]) -> None:
    if not query_tokens:
        return  # all scores stay 0.0 → selection falls back to top-chunk order
    average_idf = (sum(idf.values()) / len(idf)) if idf else 1.0
    unseen_weight = max(2.5 * average_idf, 1.0)
    query_unique = set(query_tokens)
    total_mass = sum(idf.get(token, unseen_weight) for token in query_unique) or 1.0
    rank_weights = (1.0, 0.92, 0.85, 0.78, 0.72)
    for unit in units:
        matched_mass = sum(idf.get(token, unseen_weight) for token in query_unique if token in unit.tokens)
        rank_weight = rank_weights[min(unit.chunk_rank, len(rank_weights) - 1)]
        unit.score = (matched_mass / total_mass) * rank_weight


def _is_duplicate(unit: _Unit, taken: list[_Unit]) -> bool:
    for other in taken:
        union = unit.tokens | other.tokens
        if union and len(unit.tokens & other.tokens) / len(union) >= _DUPLICATE_JACCARD:
            return True
    return False


def _select(units: list[_Unit]) -> list[_Unit]:
    """Pick the highest-scoring units, then restore reading order (chunk rank,
    position within the chunk) so the answer keeps the source's narrative flow."""
    taken: list[_Unit] = []
    for unit in sorted(units, key=lambda item: item.score, reverse=True):
        if unit.score <= 0.0:
            break  # sorted descending: everything after is also unmatched
        if _is_duplicate(unit, taken):
            continue
        taken.append(unit)
        if len(taken) >= MAX_SENTENCES:
            break
    if not taken:
        # Nothing matched (unusual phrasing of an in-scope question): fall back
        # to the opening of the best-ranked chunk so the reply still grounds
        # itself in the retrieved material instead of talking in templates only.
        taken = [unit for unit in units if unit.chunk_rank == 0][:2] or units[:2]
    while len(taken) > 2 and sum(len(unit.text) for unit in taken) > MAX_ANSWER_CHARS:
        taken.remove(min(taken, key=lambda item: item.score))
    return sorted(taken, key=lambda item: (item.chunk_rank, item.index))


# --------------------------------------------------------------------------- #
# Template layer — no facts, only framing
# --------------------------------------------------------------------------- #
_EMOTION_RE = re.compile(
    r"\b(worri\w+|scared|scary|anxious|anxiety|nervous|afraid|fear\w*|frustrat\w+|"
    r"overwhelm\w+|stress\w*|sad|depress\w*|lonely|alone|panic\w*|cry\w*|hopeless|"
    r"terrible|awful|can'?t cope|what'?s wrong with me)\b",
    re.I,
)

_EMOTION_ACKS = (
    "That sounds like a lot to carry — here is what your recovery plan says.",
    "I hear you, and that feeling makes sense. Here is what your care instructions say.",
)

_LEADINS = {
    "medication": "Here is what your instructions say about your medicines:",
    "diet": "Here is what your care plan says about eating and drinking:",
    "activity": "Here is what your recovery plan says about activity and rest:",
    "wound": "Your discharge instructions say this about wound care:",
    "red_flags": "Your care team's guidance on warning signs:",
    "process": "Here is what I can tell you:",
    "faq": "Here is what I can tell you:",
}
_DEFAULT_LEADIN = "Here is what your recovery instructions say:"

_CLOSINGS = {
    "red_flags": "If you notice any of these warning signs, contact your care team straight away.",
    "wound": "If the wound looks worse rather than better, or you are unsure, check with your care team.",
}
_DEFAULT_CLOSING = "If anything here does not match how you are feeling, please check with your care team."


def _leadin_for(categories: Sequence[str]) -> str:
    counts: dict[str, int] = {}
    for category in categories:
        counts[category] = counts.get(category, 0) + 1
    if not counts:
        return _DEFAULT_LEADIN
    dominant = max(counts.items(), key=lambda item: item[1])[0]
    return _LEADINS.get(dominant, _DEFAULT_LEADIN)


def _closing_for(categories: Sequence[str]) -> str:
    counts: dict[str, int] = {}
    for category in categories:
        counts[category] = counts.get(category, 0) + 1
    if not counts:
        return _DEFAULT_CLOSING
    dominant = max(counts.items(), key=lambda item: item[1])[0]
    return _CLOSINGS.get(dominant, _DEFAULT_CLOSING)


# --------------------------------------------------------------------------- #
# Public entry point — same shape as app.answer.stream_answer
# --------------------------------------------------------------------------- #
_NOTHING_EXTRACTED_MESSAGE = (
    "I don't have enough detail on that in your instructions — please check "
    "with your care team."
)


def _compose(request: AnswerRequest, embedder) -> list[str]:
    """The full answer as an ordered list of sentences (one future delta each)."""
    retrieval: RetrievalResult = request.retrieval
    query_tokens = _content_tokens(request.user_message)
    units = _build_units(retrieval.chunks, _idf_table(embedder), query_tokens)
    selected = _select(units)

    categories = [chunk.category for chunk in retrieval.chunks]
    sentences: list[str] = []

    first_name = (request.summary.first_name if request.summary else "") or ""
    if _EMOTION_RE.search(request.user_message or ""):
        ack = _EMOTION_ACKS[sum(ord(char) for char in request.user_message[:32]) % len(_EMOTION_ACKS)]
        sentences.append(f"{first_name}, {ack}" if first_name else ack)

    if not selected:
        # Degenerate chunks (no extractable sentences): stay honest, stay calm.
        return sentences + [_NOTHING_EXTRACTED_MESSAGE]

    # The lead-in ends in ':' so it reads as one sentence with the first fact.
    sentences.append(f"{_leadin_for(categories)} {selected[0].text}")
    sentences.extend(unit.text for unit in selected[1:])
    sentences.append(_closing_for(categories))
    return sentences


async def stream_local_answer(
    request: AnswerRequest,
    embedder=None,
) -> AsyncIterator[str]:
    """Yield the grounded answer as text deltas, extracted from retrieval.chunks.

    Never raises for content reasons: whatever the retrieval quality, the
    caller gets a complete, calm reply (templates guarantee non-empty output).
    Deltas concatenate into the full answer with single spaces, matching how
    the frontend accumulates them.
    """
    started = time.monotonic()
    sentences = _compose(request, embedder)
    for position, sentence in enumerate(sentences):
        trailing = " " if position < len(sentences) - 1 else ""
        yield f"{sentence}{trailing}"

    logger.info(
        "local answer composed in %.2fs (sentences=%d)",
        time.monotonic() - started, len(sentences),
    )


def build_local_answer_text(request: AnswerRequest, embedder=None) -> str:
    """The same composition as stream_local_answer, in one string (tests)."""
    import asyncio

    async def _collect() -> str:
        return "".join([delta async for delta in stream_local_answer(request, embedder)])

    return asyncio.run(_collect())
