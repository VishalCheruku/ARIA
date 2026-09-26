"""ARIA Recovery Copilot — configuration.

All configuration comes from environment variables (12-factor). Nothing here is
shared with the main ARIA backend except the one deliberate coupling point, the
COPILOT_SIGNING_SECRET (spec §8.5).

Assumption (spec §0): every knob that could differ between environments is an
env var with a sane local-dev default, so the module runs out of the box with
`uvicorn app.main:app`.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, "").strip() or default)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, "").strip() or default)
    except ValueError:
        return default


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    # --- LLM (GLM-5.3-flash via Z.ai, spec §5) ---
    zai_api_key: str = field(default_factory=lambda: os.getenv("ZAI_API_KEY", ""))
    zai_base_url: str = field(
        default_factory=lambda: os.getenv("ZAI_BASE_URL", "https://api.z.ai/api/paas/v4").rstrip("/")
    )
    zai_model: str = field(default_factory=lambda: os.getenv("ZAI_MODEL", "glm-5.3-flash"))
    llm_timeout_seconds: float = field(default_factory=lambda: _env_float("LLM_TIMEOUT_SECONDS", 30.0))
    llm_max_output_tokens: int = field(default_factory=lambda: _env_int("LLM_MAX_OUTPUT_TOKENS", 500))

    # --- Embeddings ---
    # provider: "zai" (API), "local" (sentence-transformers), "hash" (dev/test only)
    embedding_provider: str = field(default_factory=lambda: os.getenv("EMBEDDING_PROVIDER", "hash"))
    embedding_model: str = field(
        default_factory=lambda: os.getenv("EMBEDDING_MODEL", "embedding-3")
    )
    embedding_dimensions: int = field(default_factory=lambda: _env_int("EMBEDDING_DIMENSIONS", 1024))
    local_embedding_model: str = field(
        default_factory=lambda: os.getenv("LOCAL_EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
    )

    # --- MongoDB (own database: aria_copilot — NEVER the main app's database) ---
    mongodb_uri: str = field(default_factory=lambda: os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
    mongodb_db: str = field(default_factory=lambda: os.getenv("MONGODB_DB", "aria_copilot"))
    atlas_vector_index: str = field(default_factory=lambda: os.getenv("ATLAS_VECTOR_INDEX", "kb_vector_index"))
    atlas_fallback_seconds: float = field(
        default_factory=lambda: _env_float("ATLAS_FALLBACK_RETRY_SECONDS", 300.0)
    )

    # --- The one deliberate coupling point with the main backend (spec §8.5) ---
    copilot_signing_secret: str = field(
        default_factory=lambda: os.getenv("COPILOT_SIGNING_SECRET", "dev-only-copilot-signing-secret")
    )
    copilot_token_audience: str = field(default_factory=lambda: os.getenv("COPILOT_TOKEN_AUDIENCE", "aria-copilot"))
    copilot_token_max_age_seconds: int = field(
        default_factory=lambda: _env_int("COPILOT_TOKEN_MAX_AGE_SECONDS", 300)
    )

    # --- Main backend (read context-summary / write alerts; spec §8.3, §8.4) ---
    main_backend_url: str = field(
        default_factory=lambda: os.getenv("MAIN_BACKEND_URL", "http://localhost:5000").rstrip("/")
    )
    # Spec §4.3: strict timeout (2s connect, 4s total)
    main_connect_timeout: float = field(default_factory=lambda: _env_float("MAIN_CONNECT_TIMEOUT", 2.0))
    main_total_timeout: float = field(default_factory=lambda: _env_float("MAIN_TOTAL_TIMEOUT", 4.0))
    breaker_failure_threshold: int = field(default_factory=lambda: _env_int("BREAKER_FAILURE_THRESHOLD", 3))
    breaker_reset_seconds: float = field(default_factory=lambda: _env_float("BREAKER_RESET_SECONDS", 30.0))
    context_cache_ttl_seconds: float = field(
        default_factory=lambda: _env_float("CONTEXT_CACHE_TTL_SECONDS", 900.0)
    )

    # --- Retrieval (spec §8.2) ---
    retrieval_top_k: int = field(default_factory=lambda: _env_int("RETRIEVAL_TOP_K", 5))
    retrieval_threshold: float = field(default_factory=lambda: _env_float("RETRIEVAL_THRESHOLD", 0.72))

    # --- HTTP surface ---
    cors_origins: list[str] = field(
        default_factory=lambda: _env_list(
            "CORS_ORIGINS",
            ["http://localhost:5173", "http://localhost:5000", "http://127.0.0.1:5173"],
        )
    )
    # Stage-2 model-based triage can be disabled for offline dev/tests.
    triage_stage2_enabled: bool = field(default_factory=lambda: _env_bool("TRIAGE_STAGE2_ENABLED", True))
    conversation_history_messages: int = field(
        default_factory=lambda: _env_int("CONVERSATION_HISTORY_MESSAGES", 8)
    )
    session_context_timeout_seconds: float = field(
        default_factory=lambda: _env_float("SESSION_CONTEXT_TIMEOUT_SECONDS", 5.0)
    )
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
