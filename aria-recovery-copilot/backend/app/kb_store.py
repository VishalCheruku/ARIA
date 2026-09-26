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


class MongoKBStore:
    """kb_chunks in the Copilot's own Mongo database.

    Primary path: Atlas `$vectorSearch`. Fallback path: in-process cosine scan
    with a TTL cache (retries Atlas after `atlas_fallback_seconds`).
    """

    def __init__(self, collection, atlas_index: str, atlas_fallback_seconds: float = 300.0) -> None:
        self._collection = collection
        self._index = atlas_index
        self._atlas_disabled_until: float = 0.0
        self._fallback_seconds = atlas_fallback_seconds
        self._all_chunks_cache: tuple[float, list[dict]] | None = None
        self._cache_ttl = 60.0

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
    ) -> list[ChunkResult]:
        if time.monotonic() < self._atlas_disabled_until:
            return await self._fallback_search(query_embedding, query_model, top_k, categories)
        try:
            results = await self._atlas_search(query_embedding, query_model, top_k, categories)
            return results
        except Exception as error:
            logger.warning("Atlas Vector Search unavailable (%s); using in-process fallback", error)
            self._atlas_disabled_until = time.monotonic() + self._fallback_seconds
            return await self._fallback_search(query_embedding, query_model, top_k, categories)

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
    ) -> list[ChunkResult]:
        chunks = await self._load_all()
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
        self._index: list[tuple[dict, int]] = []
        if scoring == "bm25":
            self._build_bm25_index()

    # ---- BM25 machinery ----
    _K1 = 1.5
    _B = 0.3  # gentler length normalization than IR default; chunks are topical
    _COVERAGE_FLOOR = 0.5  # chunk must match at least half the query's IDF mass

    def _build_bm25_index(self) -> None:
        from collections import Counter

        self._index = []
        for record in self._records:
            # Title weighted 3x: chunk titles are the best topical summary.
            tokens = self._tokenize(
                f"{record.source_title} {record.source_title} {record.source_title}. "
                f"{', '.join(record.tags)}. {record.text}"
            )
            counts = Counter(tokens)
            self._index.append((dict(counts), len(tokens)))
        self._avg_len = (sum(length for _, length in self._index) / max(1, len(self._index))) or 1.0
        document_frequency: Counter = Counter()
        for counts, _ in self._index:
            document_frequency.update(counts.keys())
        total = max(1, len(self._index))
        self._idf = {token: ((total - df + 0.5) / (df + 0.5) + 1.0) for token, df in document_frequency.items()}
        self._max_idf = max(self._idf.values(), default=1.0)

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        from app.embeddings import _content_tokens

        return _content_tokens(text)

    def _bm25_scores(self, query_text: str) -> list[tuple[float, int]]:
        from collections import Counter

        query_counts = Counter(self._tokenize(query_text))
        scores: list[tuple[float, int]] = []
        for position, (counts, length) in enumerate(self._index):
            score = 0.0
            for token, query_tf in query_counts.items():
                idf = self._idf.get(token)
                if not idf:
                    continue
                tf = counts.get(token, 0)
                if not tf:
                    continue
                score += idf * tf * (self._K1 + 1.0) / (tf + self._K1 * (1.0 - self._B + self._B * length / self._avg_len))
            scores.append((score, position))
        scores.sort(key=lambda pair: pair[0], reverse=True)
        return scores

    @staticmethod
    def _normalize_bm25(score: float) -> float:
        """Map BM25 (unbounded, ~0-15 for these chunks) to 0-1 for a stable
        threshold: score_norm = s / (s + 4) -> 1.33 raw ≈ 0.25 norm."""
        return score / (score + 4.0)

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
        from collections import Counter

        query_counts = Counter(self._tokenize(query_text))
        if not query_counts:
            return []
        # Coverage weighting: a chunk that matches only a common fragment of
        # the query ("open" in "when does the cafeteria open?") must not look
        # reliable. Each candidate's score is scaled by the share of the
        # query's IDF mass its matched terms cover; unknown query terms are
        # weighted at 2.5x the corpus-average IDF (calibrated on the test
        # suite: unmatchable words are usually the informative ones).
        avg_idf = sum(self._idf.values()) / max(1, len(self._idf))
        query_idf_total = sum(self._idf.get(token, avg_idf * 2.5) for token in query_counts)
        ranked = self._bm25_scores(query_text)
        results = []
        for score, position in ranked:
            if score <= 0.0:
                break
            counts, _length = self._index[position]
            matched_weight = sum(
                self._idf[token] for token in query_counts if counts.get(token) and token in self._idf
            )
            coverage = matched_weight / query_idf_total if query_idf_total else 0.0
            if coverage < self._COVERAGE_FLOOR:
                continue
            final = self._normalize_bm25(score) * coverage
            record = self._records[position]
            if categories and record.category not in categories:
                continue
            results.append(self._to_result(final, record))
            if len(results) >= top_k:
                break
        results.sort(key=lambda chunk: chunk.score, reverse=True)
        return results

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
