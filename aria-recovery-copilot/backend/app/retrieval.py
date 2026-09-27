"""Retrieval pipeline (spec §8.2).

`retrieve(query_text, ...)`:
  1. embed the query,
  2. vector-search kb_chunks, optionally narrowing by category when the
     question clearly maps to one (medication / diet / activity / wound /
     red flags / process / faq),
  3. retry unfiltered when the filtered search comes back thin,
  4. return chunks + scores, or an explicit "no reliable match" result when
     the best score is under the threshold (start: 0.72 cosine — tune in
     testing; the hash dev embedder uses a lower threshold because lexical
     cosine runs lower than semantic cosine).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Optional

from app.embeddings import EmbeddingClient
from app.kb_store import ChunkResult, KBStore

logger = logging.getLogger("aria.copilot.retrieval")

# Category inference — deliberately conservative: a wrong filter is worse than
# no filter because the unfiltered retry below only triggers on thin results.
_CATEGORY_HINTS: list[tuple[str, re.Pattern[str]]] = [
    ("medication", re.compile(
        r"\b(medicines?|medications?|meds|tablets?|pills?|capsules?|doses?|dosing|drugs?|prescriptions?|"
        r"antibiotics?|painkillers?|insulin|blood\s*thinners?|inhalers?|pharmacy|refill)\b", re.I)),
    ("diet", re.compile(
        r"\b(eat|eating|diet|foods?|meals?|nutrition|salt|sodium|sugar\s+intake|"
        r"fluids?|water\s+intake|drink|drinking|caffeine|alcohol|vegetables?|proteins?)\b", re.I)),
    ("activity", re.compile(
        r"\b(exercise|exercising|walk|walking|activity|lift|lifting|drive|driving|work|"
        r"working|return\s+to\s+work|travel|travelling|traveling|climb|stairs|sex|bath|shower|"
        r"bathing|yoga|gym|swim|swimming)\b", re.I)),
    ("wound", re.compile(
        r"\b(wounds?|incision|stitch|stitches|sutures?|staples?|dressing|bandages?|"
        r"scars?|surgical\s+site|cut\s+site|operation\s+site|drains?)\b", re.I)),
    ("red_flags", re.compile(
        r"\b(warnings?|danger|dangerous|emergency|worry|worried|concern|concerned|"
        r"normal|abnormal|when\s+should\s+i\s+call|call\s+the\s+(doctor|hospital|care\s+team)|"
        r"signs?\s+of\s+\w+)", re.I)),
    ("process", re.compile(
        r"\b(aria|risk\s+tiers?|risk\s+scores?|sms|messages?|calls?|reminders?|monitoring|"
        r"calendars?|follow\s*-?\s*ups?|alerts?)\b", re.I)),
    ("faq", re.compile(
        r"\b(how\s+(do|can)\s+i\s+(reach|contact)|care\s+team|appointments?|missed\s+(a\s+)?(call|sms)|"
        r"who\s+do\s+i\s+(call|ask)|what\s+can\s+you\s+(do|help))\b", re.I)),
]

_HASH_THRESHOLD = 0.22  # BM25-normalized floor for the lexical dev embedder (s/(s+4))


@dataclass
class RetrievalResult:
    chunks: list[ChunkResult] = field(default_factory=list)
    best_score: float = 0.0
    used_categories: Optional[list[str]] = None
    reliable: bool = False
    # Below-threshold nearest chunks, kept ONLY when unreliable so the chat
    # route can turn them into "I can help with…" topic suggestions. When
    # reliable, `chunks` is the answer material and `near_misses` stays empty.
    near_misses: list[ChunkResult] = field(default_factory=list)


def infer_categories(question: str) -> Optional[list[str]]:
    categories = [name for name, pattern in _CATEGORY_HINTS if pattern.search(question or "")]
    return categories or None


async def retrieve(
    query_text: str,
    embedder: EmbeddingClient,
    store: KBStore,
    *,
    top_k: int = 5,
    threshold: float = 0.72,
    embedder_is_lexical: bool = False,
) -> RetrievalResult:
    """`embedder_is_lexical` is normally derived from the embedder itself; see
    `is_lexical_provider()`."""
    if getattr(embedder, "is_lexical", False):
        embedder_is_lexical = True
    effective_threshold = _HASH_THRESHOLD if embedder_is_lexical else threshold
    vectors = await embedder.embed([query_text])
    query_embedding = vectors[0]

    categories = infer_categories(query_text)
    chunks: list[ChunkResult] = []
    if categories:
        # Category inference is a heuristic guess, so run BOTH searches and
        # merge: a question phrased like "can I drive after my procedure?"
        # infers activity, but the best chunk may be tagged faq. The filtered
        # search keeps precision at scale; the unfiltered one guarantees the
        # merge is never thinner than a plain search.
        filtered, unfiltered = await _gather(
            store.search(query_embedding, embedder.name, top_k, categories, query_text,
                         prefer_fallback=embedder_is_lexical),
            store.search(query_embedding, embedder.name, top_k, None, query_text,
                         prefer_fallback=embedder_is_lexical),
        )
        chunks = _merge_chunks(filtered, unfiltered)[:top_k]
    else:
        chunks = await store.search(query_embedding, embedder.name, top_k, None, query_text,
                                    prefer_fallback=embedder_is_lexical)

    best = max((chunk.score for chunk in chunks), default=0.0)
    reliable = bool(chunks) and best >= effective_threshold
    if not reliable:
        # Keep the below-threshold neighbours: the chat route turns their
        # categories into topic suggestions instead of a bare deferral.
        return RetrievalResult(chunks=[], best_score=best, used_categories=categories,
                               reliable=False, near_misses=chunks)
    return RetrievalResult(chunks=chunks, best_score=best, used_categories=categories, reliable=True)


async def _gather(*awaitables):
    import asyncio

    return await asyncio.gather(*awaitables)


def _merge_chunks(*groups: list[ChunkResult]) -> list[ChunkResult]:
    merged: dict[str, ChunkResult] = {}
    for group in groups:
        for chunk in group:
            existing = merged.get(chunk.id)
            if existing is None or chunk.score > existing.score:
                merged[chunk.id] = chunk
    return sorted(merged.values(), key=lambda chunk: chunk.score, reverse=True)
