"""Embedding clients for the Copilot's RAG pipeline (spec §5, §8.2).

Providers (EMBEDDING_PROVIDER):
  "zai"   — Z.ai embeddings endpoint (production default when an API key with
            embedding access is configured).
  "local" — sentence-transformers running in-process (optional dependency:
            `pip install sentence-transformers`; model is downloaded on first
            use, hence NOT part of requirements.txt).
  "hash"  — deterministic signed feature-hashing embedder with NO network and
            NO third-party dependency. Dev/test fallback only: it is lexical
            (bag of words + bigrams + char 4-grams), so it behaves reasonably
            for smoke tests but is inferior to real semantic embeddings. Do
            not use in production.

IMPORTANT: embeddings from different providers/models are not comparable.
`seed_kb.py` stamps the model name + dimensions on every kb_chunk, and the
vector store validates them at query time.
"""

from __future__ import annotations

import hashlib
import logging
import math
import os
import re
from pathlib import Path
from typing import Protocol, Sequence

import httpx

from app.config import Settings

logger = logging.getLogger("aria.copilot.embeddings")

_TOKEN_RE = re.compile(r"[a-z0-9]+")

# Compact stopword set for the lexical embedder: function words carry no
# retrieval signal and dilute short queries against long chunks.
_STOPWORDS = frozenset("""
a an the and or but if of at by for with about into to from in on is are was
were be been being am do does did doing have has had having i you he she it we
they me him her us them my your his its our their mine yours this that these
those there here what which who whom whose when where why how can could should
would will shall may might must not no nor so too very just also then than
once because as until while after before during between against above below
up down out off over under again further all any both each few more most other
some such only own same s t don now much many myself yourself himself herself
itself themselves oneself
""".split())


def _stem(token: str) -> str:
    """Very small suffix stripper — only needs to be SYMMETRIC between queries
    and documents (eat/eating, drive/driving, surgery/surgeries, ...)."""
    for suffix, replacement in (("ies", "y"), ("sses", "ss"), ("ing", ""), ("ed", ""), ("es", ""), ("s", ""), ("e", "")):
        if token.endswith(suffix) and len(token) - len(suffix) >= 3:
            return token[: len(token) - len(suffix)] + replacement
    return token


def _content_tokens(text: str) -> list[str]:
    return [
        _stem(token)
        for token in _TOKEN_RE.findall((text or "").lower())
        if token not in _STOPWORDS and len(token) > 1
    ]


class EmbeddingError(RuntimeError):
    pass


class EmbeddingClient(Protocol):
    name: str
    dimensions: int

    async def embed(self, texts: Sequence[str]) -> list[list[float]]: ...


class ZaiEmbeddingClient:
    def __init__(self, settings: Settings) -> None:
        if not settings.zai_api_key:
            raise EmbeddingError("ZAI_API_KEY is not configured")
        self._client = httpx.AsyncClient(
            base_url=settings.zai_base_url,
            headers={"Authorization": f"Bearer {settings.zai_api_key}", "Content-Type": "application/json"},
            timeout=httpx.Timeout(20.0, connect=5.0),
        )
        self.name = settings.embedding_model
        self.dimensions = settings.embedding_dimensions

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        try:
            response = await self._client.post(
                "/embeddings",
                json={"model": self.name, "input": list(texts), "dimensions": self.dimensions},
            )
            response.raise_for_status()
            data = response.json()
            vectors = [item["embedding"] for item in data.get("data", [])]
            if len(vectors) != len(texts):
                raise EmbeddingError(f"expected {len(texts)} embeddings, got {len(vectors)}")
            for vector in vectors:
                if len(vector) != self.dimensions:
                    raise EmbeddingError(
                        f"embedding dimensions mismatch: got {len(vector)}, expected {self.dimensions}"
                    )
            return vectors
        except (httpx.HTTPError, KeyError, ValueError) as error:
            raise EmbeddingError(f"Z.ai embedding request failed: {error}") from error


class LocalSentenceTransformerClient:
    """sentence-transformers in-process; lazy import + threadpool offload."""

    def __init__(self, model_name: str) -> None:
        self.name = model_name
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore
        except ImportError as error:  # pragma: no cover - depends on optional install
            raise EmbeddingError(
                "EMBEDDING_PROVIDER=local requires `pip install sentence-transformers`"
            ) from error
        self._model = SentenceTransformer(model_name)
        probe = self._model.get_sentence_embedding_dimension()
        self.dimensions = int(probe or 384)

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        loop = __import__("asyncio").get_running_loop()
        vectors = await loop.run_in_executor(None, lambda: self._model.encode(list(texts), normalize_embeddings=True))
        return [list(map(float, vector)) for vector in vectors]


class HashEmbeddingClient:
    """Deterministic, dependency-free lexical embedder (dev/tests only).

    TF-IDF-weighted signed feature hashing over word unigrams, L2-normalized.
    Unigrams only — char n-grams added collision noise — and IDF weighting
    (fitted on the seeded corpus via `fit_records`, persisted via
    `save_idf`/`load_idf`) makes rare clinical words dominate the similarity,
    which separates good matches from out-of-scope questions cleanly.

    If never fitted, weights default to 1.0 (usable, weaker). Stable across
    runs and machines so seeded dev data keeps working without a model
    download.
    """

    def __init__(self, dimensions: int = 4096) -> None:
        self.name = "lexical-tfidf-v2"
        self.dimensions = dimensions
        self.is_lexical = True
        self._idf: dict[str, float] = {}

    # -- corpus fitting (dev/test/seed only) --
    async def fit_records(self, texts: Sequence[str]) -> None:
        from collections import Counter
        from math import log

        document_frequency: Counter = Counter()
        for text in texts:
            document_frequency.update(set(_content_tokens(text)))
        total = max(1, len(texts))
        self._idf = {
            token: log((total + 1) / (count + 1)) + 1.0
            for token, count in document_frequency.items()
        }

    def save_idf(self, path) -> None:
        import json
        from pathlib import Path

        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(json.dumps(self._idf), encoding="utf-8")

    def load_idf(self, path) -> bool:
        import json
        from pathlib import Path

        file = Path(path)
        if not file.exists():
            return False
        self._idf = json.loads(file.read_text(encoding="utf-8"))
        return True

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        return [self._embed_one(text) for text in texts]

    def _embed_one(self, text: str) -> list[float]:
        from collections import Counter
        from math import log, sqrt

        vector = [0.0] * self.dimensions
        tokens = _content_tokens(text)
        if not tokens:
            return vector
        term_frequency = Counter(tokens)
        for token, tf in term_frequency.items():
            weight = (1.0 + log(tf)) * self._idf.get(token, 1.0)
            digest = hashlib.md5(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "little") % self.dimensions
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vector[index] += sign * weight
        norm = sqrt(sum(component * component for component in vector)) or 1.0
        return [component / norm for component in vector]


def embed_text_for_record(record, *, lexical: bool = False) -> str:
    """The canonical text that gets embedded for a KB record.

    Semantic providers embed the full composite (title + tags sharpen
    retrieval there too). The lexical dev/test provider embeds a TOPIC WINDOW
    — title, tags, and the head/tail content tokens of the body — because
    bag-of-words cosine between a short query and a 300-word chunk dilutes
    into noise; a query-sized document vector keeps scores separated.
    """
    base = f"{record.source_title}. {', '.join(record.tags)}."
    if not lexical:
        return f"{base} {record.text}"
    tokens = _content_tokens(record.text)
    window = tokens[:70] + (tokens[-35:] if len(tokens) > 105 else [])
    return f"{base} {' '.join(window)}"


def build_embedder(settings: Settings) -> EmbeddingClient:
    provider = (settings.embedding_provider or "hash").strip().lower()
    if provider == "zai":
        return ZaiEmbeddingClient(settings)
    if provider == "local":
        return LocalSentenceTransformerClient(settings.local_embedding_model)
    if provider == "hash":
        logger.warning("EMBEDDING_PROVIDER=hash is a dev/test fallback — not suitable for production")
        embedder = HashEmbeddingClient(dimensions=4096)
        idf_path = os.getenv(
            "LEXICAL_IDF_PATH",
            str(Path(__file__).resolve().parent.parent / "data" / "lexical_idf.json"),
        )
        if embedder.load_idf(idf_path):
            logger.info("lexical embedder loaded IDF table from %s", idf_path)
        else:
            logger.warning("no IDF table at %s — run scripts/seed_kb.py to fit one", idf_path)
        return embedder
    raise EmbeddingError(f"Unknown EMBEDDING_PROVIDER: {provider!r}")
