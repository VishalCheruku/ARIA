"""Knowledge-base stores and vector search (spec §7, §8.2, §10).

The vector store is MongoDB Atlas Vector Search living in the Copilot's OWN
`aria_copilot` database (collection `kb_chunks`). If Atlas Vector Search is
unavailable (no search index yet, non-Atlas Mongo, transient error), the store
transparently falls back to an in-process cosine scan over all chunks — fine
for the 60–120 chunk v1 knowledge base — and retries Atlas later.

Embedding-compatibility rule: every kb_chunk records `embedding_model` and
`embedding_dim`; the store refuses to mix them with a query embedding from a
different model/dims (stale seed data must be re-seeded, not silently mixed).
"""

from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass, field
from typing import Any, Optional, Protocol, Sequence

logger = logging.getLogger("aria.copilot.kb")


@dataclass(frozen=True)
class ChunkResult:
    id: str
    source_title: str
    source_type: str
    category: str
    text: str
    tags: list[str]
    score: float


@dataclass
class KBRecord:
    source_title: str
    source_type: str   # guideline | drug_info | faq | discharge_template
    category: str      # medication | diet | activity | red_flags | wound | process | faq
    text: str
    tags: list[str] = field(default_factory=list)
    embedding: list[float] = field(default_factory=list)
    embedding_model: str = ""
    embedding_dim: int = 0
    _id: Any = None


class KBStoreError(RuntimeError):
    pass


class EmbeddingMismatch(KBStoreError):
    pass


class KBStore(Protocol):
    async def search(
        self,
        query_embedding: Sequence[float],
        query_model: str,
        top_k: int,
        categories: Optional[list[str]] = None,
        query_text: str = "",
        *,
        prefer_fallback: bool = False,
    ) -> list[ChunkResult]: ...

    async def count(self) -> int: ...


def cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


class BM25Scorer:
    """BM25 ranking over chunk texts, shared by the in-memory store and the
    Mongo fallback path.

    Used with the lexical dev embedder, because bag-of-words cosine between a
    short query and long chunks dilutes into noise (see app/embeddings.py).
    BM25's length normalization is the correct tool — and the in-memory store
    (which the whole test suite exercises) has always used it, so the Mongo
    fallback must rank identically or dev behaves differently from tests.
    """

    _K1 = 1.5
    _B = 0.3  # gentler length normalization than IR default; chunks are topical
    _COVERAGE_FLOOR = 0.5  # chunk must match at least half the query's IDF mass

    def __init__(self, documents: Sequence[tuple[str, Sequence[str], str]]) -> None:
        """`documents`: one (source_title, tags, text) tuple per chunk; the
        position of each tuple is its document id for `score_query`."""
        from collections import Counter

        from app.embeddings import _content_tokens

        self._index: list[tuple[Counter, int]] = []
        for title, tags, text in documents:
            # Title weighted 3x: chunk titles are the best topical summary.
            tokens = _content_tokens(
                f"{title} {title} {title}. {', '.join(tags)}. {text}"
            )
            self._index.append((Counter(tokens), len(tokens)))
        self._avg_len = (sum(length for _, length in self._index) / max(1, len(self._index))) or 1.0
        document_frequency: Counter = Counter()
        for counts, _ in self._index:
            document_frequency.update(counts.keys())
        total = max(1, len(self._index))
        self._idf = {
            token: ((total - df + 0.5) / (df + 0.5) + 1.0)
            for token, df in document_frequency.items()
        }

    def score_query(self, query_text: str) -> list[float]:
        """Final 0-1 score per document: normalized BM25 scaled by the share of
        the query's IDF mass the document covers. Documents below the coverage
        floor score 0 (a chunk matching only a common fragment must not look
        reliable)."""
        from collections import Counter

        from app.embeddings import _content_tokens

        query_counts = Counter(_content_tokens(query_text))
        if not query_counts:
            return [0.0] * len(self._index)
        avg_idf = sum(self._idf.values()) / max(1, len(self._idf))
        # Unknown query terms are weighted at 2.5x the corpus-average IDF
        # (calibrated on the test suite: unmatchable words are usually the
        # informative ones).
        query_idf_total = sum(self._idf.get(token, avg_idf * 2.5) for token in query_counts)
        scores: list[float] = []
        for counts, length in self._index:
            raw = 0.0
            for token, _query_tf in query_counts.items():
                idf = self._idf.get(token)
                if not idf:
                    continue
                tf = counts.get(token, 0)
                if not tf:
                    continue
                raw += idf * tf * (self._K1 + 1.0) / (tf + self._K1 * (1.0 - self._B + self._B * length / self._avg_len))
            if raw <= 0.0:
                scores.append(0.0)
                continue
            matched_weight = sum(
                self._idf[token] for token in query_counts if counts.get(token) and token in self._idf
            )
            coverage = matched_weight / query_idf_total if query_idf_total else 0.0
            scores.append(0.0 if coverage < self._COVERAGE_FLOOR else self._normalize(raw) * coverage)
        return scores

    @staticmethod
    def _normalize(score: float) -> float:
        """Map BM25 (unbounded, ~0-15 for these chunks) to 0-1 for a stable
        threshold: score_norm = s / (s + 4) -> 1.33 raw ≈ 0.25 norm."""
        return score / (score + 4.0)


class MongoKBStore:
    """kb_chunks in the Copilot's own Mongo database.

    Primary path: Atlas `$vectorSearch`. Fallback path: in-process cosine scan
    with a TTL cache (retries Atlas after `atlas_fallback_seconds`).
    """

    def __init__(self, collection, atlas_index: str, atlas_fallback_seconds: float = 300.0,
                 cache_ttl_seconds: float = 3600.0) -> None:
        self._collection = collection
        self._index = atlas_index
        self._atlas_disabled_until: float = 0.0
        self._fallback_seconds = atlas_fallback_seconds
        self._all_chunks_cache: tuple[float, list[dict]] | None = None
        # The KB is essentially static (re-seeded rarely), so the in-process
        # chunk cache can live far longer than one conversation: with the old
        # 60s TTL, the FIRST retrieval after every idle minute re-pulled all
        # chunks over a slow Atlas link — a 25-30s answer for the patient.
        self._cache_ttl = cache_ttl_seconds
        self._bm25_cache: tuple[float, BM25Scorer] | None = None

    async def warmup(self) -> None:
        """Pre-load the chunk cache so the first real question never pays the
        cold Atlas read. Best-effort: failures are fine (the first search
        retries lazily)."""
        try:
            await self._load_all()
        except Exception:  # pragma: no cover — warmup is opportunistic
            pass

    async def count(self) -> int:
        try:
            return await self._collection.count_documents({})
        except Exception as error:
            raise KBStoreError(f"kb_chunks count failed: {error}") from error

    async def search(
        self,
        query_embedding: Sequence[float],
        query_model: str,
        top_k: int,
        categories: Optional[list[str]] = None,
        query_text: str = "",
        *,
        prefer_fallback: bool = False,
    ) -> list[ChunkResult]:
        # The lexical dev embedder produces hash vectors with no geometric
        # meaning — an Atlas $vectorSearch over them is meaningless even when
        # the index exists, and its ~3s latency per first query is pure waste.
        # Go straight to the in-process BM25 scan in that case.
        if prefer_fallback or time.monotonic() < self._atlas_disabled_until:
            return await self._fallback_search(query_embedding, query_model, top_k, categories, query_text)
        try:
            results = await self._atlas_search(query_embedding, query_model, top_k, categories)
            if results:
                return results
            # Atlas returns an EMPTY result set (not an error) when the search
            # index is missing or matches nothing. A missing index must never
            # silently disable retrieval — fall back to the in-process scan.
            logger.info("Atlas vectorSearch returned 0 rows; using in-process fallback")
            self._atlas_disabled_until = time.monotonic() + self._fallback_seconds
            return await self._fallback_search(query_embedding, query_model, top_k, categories, query_text)
        except Exception as error:
            logger.warning("Atlas Vector Search unavailable (%s); using in-process fallback", error)
            self._atlas_disabled_until = time.monotonic() + self._fallback_seconds
            return await self._fallback_search(query_embedding, query_model, top_k, categories, query_text)

    async def _atlas_search(
        self,
        query_embedding: Sequence[float],
        query_model: str,
        top_k: int,
        categories: Optional[list[str]],
    ) -> list[ChunkResult]:
        vector_field = "embedding"
        num_candidates = max(top_k * 10, 50)
        search_stage: dict[str, Any] = {
            "index": self._index,
            "path": vector_field,
            "queryVector": list(query_embedding),
            "numCandidates": num_candidates,
            "limit": top_k,
        }
        if categories:
            search_stage["filter"] = {"category": {"$in": list(categories)}}
        pipeline = [
            {"$vectorSearch": search_stage},
            {"$project": {
                "source_title": 1, "source_type": 1, "category": 1, "text": 1, "tags": 1,
                "embedding_model": 1, "embedding_dim": 1, "score": {"$meta": "vectorSearchScore"},
            }},
        ]
        docs = await self._collection.aggregate(pipeline).to_list(length=top_k)
        results = []
        for doc in docs:
            self._validate_embedding_meta(doc, query_model, len(query_embedding))
            results.append(ChunkResult(
                id=str(doc["_id"]),
                source_title=doc.get("source_title", ""),
                source_type=doc.get("source_type", ""),
                category=doc.get("category", ""),
                text=doc.get("text", ""),
                tags=list(doc.get("tags") or []),
                score=float(doc.get("score") or 0.0),
            ))
        return results

    async def _fallback_search(
        self,
        query_embedding: Sequence[float],
        query_model: str,
        top_k: int,
        categories: Optional[list[str]],
        query_text: str = "",
    ) -> list[ChunkResult]:
        chunks = await self._load_all()
        if query_model.startswith("lexical"):
            # Lexical dev embedder: BM25 ranking (same math as InMemoryKBStore,
            # which the test suite exercises) — cosine on bag-of-words vectors
            # dilutes a short query against long chunks into noise.
            return self._search_bm25(chunks, query_text, top_k, categories)
        scored = []
        for chunk in chunks:
            self._validate_embedding_meta(chunk, query_model, len(query_embedding))
            if categories and chunk.get("category") not in categories:
                continue
            score = cosine_similarity(query_embedding, chunk.get("embedding") or [])
            scored.append((score, chunk))
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [
            ChunkResult(
                id=str(chunk["_id"]),
                source_title=chunk.get("source_title", ""),
                source_type=chunk.get("source_type", ""),
                category=chunk.get("category", ""),
                text=chunk.get("text", ""),
                tags=list(chunk.get("tags") or []),
                score=score,
            )
            for score, chunk in scored[:top_k]
        ]

    def _search_bm25(
        self,
        chunks: list[dict],
        query_text: str,
        top_k: int,
        categories: Optional[list[str]],
    ) -> list[ChunkResult]:
        scorer = self._get_bm25_scorer()
        scores = scorer.score_query(query_text)
        scored: list[tuple[float, dict]] = []
        for position, chunk in enumerate(chunks):
            if categories and chunk.get("category") not in categories:
                continue
            if scores[position] <= 0.0:
                continue
            scored.append((scores[position], chunk))
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [
            ChunkResult(
                id=str(chunk["_id"]),
                source_title=chunk.get("source_title", ""),
                source_type=chunk.get("source_type", ""),
                category=chunk.get("category", ""),
                text=chunk.get("text", ""),
                tags=list(chunk.get("tags") or []),
                score=score,
            )
            for score, chunk in scored[:top_k]
        ]

    def _get_bm25_scorer(self) -> BM25Scorer:
        """Build (or rebuild after a cache refresh) the BM25 index over the
        currently cached chunk documents."""
        chunks = self._all_chunks_cache[1] if self._all_chunks_cache else []
        cache_stamp = self._all_chunks_cache[0] if self._all_chunks_cache else 0.0
        if self._bm25_cache is None or self._bm25_cache[0] != cache_stamp:
            self._bm25_cache = (
                cache_stamp,
                BM25Scorer([
                    (chunk.get("source_title", ""), list(chunk.get("tags") or []), chunk.get("text", ""))
                    for chunk in chunks
                ]),
            )
        return self._bm25_cache[1]

    async def _load_all(self) -> list[dict]:
        now = time.monotonic()
        if self._all_chunks_cache and now - self._all_chunks_cache[0] < self._cache_ttl:
            return self._all_chunks_cache[1]
        docs = await self._collection.find({}).to_list(length=500)
        self._all_chunks_cache = (now, docs)
        return docs

    @staticmethod
    def _validate_embedding_meta(doc: dict, query_model: str, query_dim: int) -> None:
        doc_model = doc.get("embedding_model") or ""
        doc_dim = int(doc.get("embedding_dim") or 0)
        if doc_model and doc_model != query_model:
            raise EmbeddingMismatch(
                f"kb_chunks embedded with '{doc_model}' but queries use '{query_model}'. "
                "Re-run scripts/seed_kb.py with the current EMBEDDING_PROVIDER."
            )
        if doc_dim and doc_dim != query_dim:
            raise EmbeddingMismatch(
                f"kb_chunks dimension {doc_dim} != query dimension {query_dim}. Re-run scripts/seed_kb.py."
            )


class InMemoryKBStore:
    """Deterministic store for tests/dev.

    scoring="vector": brute-force cosine over record embeddings (matches the
    semantic production path). scoring="bm25": proper BM25 ranking over the
    chunk texts — used with the lexical dev embedder, because bag-of-words
    cosine between a short query and long chunks dilutes into noise (see
    app/embeddings.py). BM25's length normalization is the correct tool.
    """

    def __init__(self, records: Sequence[KBRecord], *, scoring: str = "vector") -> None:
        self._records = [self._with_id(record, index) for index, record in enumerate(records)]
        self.model_name = records[0].embedding_model if records else ""
        self._scoring = scoring
        self._bm25: BM25Scorer | None = None
        if scoring == "bm25":
            self._bm25 = BM25Scorer([
                (record.source_title, record.tags, record.text) for record in self._records
            ])

    @staticmethod
    def _with_id(record: KBRecord, index: int) -> KBRecord:
        record._id = record._id or f"chunk-{index}"
        return record

    async def count(self) -> int:
        return len(self._records)

    async def search(
        self,
        query_embedding: Sequence[float],
        query_model: str,
        top_k: int,
        categories: Optional[list[str]] = None,
        query_text: str = "",
        *,
        prefer_fallback: bool = False,
    ) -> list[ChunkResult]:
        if self._scoring == "bm25":
            return self._search_bm25(query_text, top_k, categories)
        scored = []
        for record in self._records:
            if record.embedding_model and record.embedding_model != query_model:
                raise EmbeddingMismatch(f"chunk model {record.embedding_model} != query model {query_model}")
            if categories and record.category not in categories:
                continue
            score = cosine_similarity(query_embedding, record.embedding)
            scored.append((score, record))
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [self._to_result(score, record) for score, record in scored[:top_k]]

    def _search_bm25(self, query_text: str, top_k: int, categories: Optional[list[str]]) -> list[ChunkResult]:
        # Ranking lives in the shared BM25Scorer so the Mongo fallback path
        # (production, no Atlas Vector Search) behaves identically to this
        # test/dev store.
        assert self._bm25 is not None
        scores = self._bm25.score_query(query_text)
        scored = []
        for position, record in enumerate(self._records):
            if scores[position] <= 0.0:
                continue
            if categories and record.category not in categories:
                continue
            scored.append((scores[position], record))
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [self._to_result(score, record) for score, record in scored[:top_k]]

    @staticmethod
    def _to_result(score: float, record: KBRecord) -> ChunkResult:
        return ChunkResult(
            id=str(record._id),
            source_title=record.source_title,
            source_type=record.source_type,
            category=record.category,
            text=record.text,
            tags=list(record.tags),
            score=score,
        )
