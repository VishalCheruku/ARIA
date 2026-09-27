"""ARIA Recovery Copilot — FastAPI application factory (spec §3, §5).

A standalone, isolated FastAPI service. Its own process, its own deploy, its
own database (`aria_copilot`). If this service dies, the main ARIA platform is
physically unaffected (spec §4).

Everything injectable lives on `app.state` so tests can swap any dependency:
  settings, store, kb, embedder, llm, triage, main_client,
  session_context (session_id -> ContextSummary), session_patient_ids.
`build_state()` is callable directly so tests can populate state without
running the ASGI lifespan (httpx ASGITransport does not emit lifespan events).
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.config import Settings, get_settings
from app.db import MemoryConversationStore, MongoConversationStore
from app.embeddings import build_embedder
from app.kb_store import MongoKBStore
from app.llm.zai_client import LLMError, ZaiClient
from app.main_client import MainBackendClient
from app.routes import chat, health, session
from app.safety.triage import Triage

logger = logging.getLogger("aria.copilot")


def setup_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


class _BrokenEmbedder:
    """Stand-in when no embedder is configured: retrieval degrades to the
    honest 'no reliable match' path instead of crashing."""

    name = "unconfigured"
    dimensions = 0

    async def embed(self, texts):
        raise LLMError("embedder not configured")


class _EmptyCollection:
    """Stand-in collection so health/retrieval degrade gracefully with no Mongo."""

    async def count_documents(self, _filter):
        return 0

    def find(self, _filter):
        return self

    def aggregate(self, _pipeline):
        raise RuntimeError("Mongo unavailable")

    async def to_list(self, length):
        return []


async def build_state(app: FastAPI, settings: Settings, overrides: dict | None = None) -> None:
    """Populate app.state with every service the routes need.

    `overrides` lets tests substitute fakes: keys store, kb, embedder, llm,
    triage, main_client.
    """
    overrides = overrides or {}

    # --- Mongo (own database only) ---
    app.state.db_connected = False
    store = overrides.get("store")
    database = None
    if store is None:
        try:
            from motor.motor_asyncio import AsyncIOMotorClient

            mongo = AsyncIOMotorClient(
                settings.mongodb_uri,
                serverSelectionTimeoutMS=3000,
                appname="aria-recovery-copilot",
            )
            database = mongo[settings.mongodb_db]
            await database.command("ping")
            store = MongoConversationStore(database)
            await store.ensure_indexes()
            app.state.mongo = mongo
            app.state.db_connected = True
            logger.info("connected to Copilot database '%s'", settings.mongodb_db)
        except Exception as error:
            # Fail loud to logs, fail quiet to users: the API still boots.
            app.state.mongo = None
            store = MemoryConversationStore()
            logger.error("Mongo unavailable — using in-process memory store for this boot: %s", error)

    app.state.settings = settings
    app.state.store = store
    app.state.session_context = {}
    app.state.session_patient_ids = {}

    # --- Embeddings + KB store ---
    app.state.embedder = overrides.get("embedder")
    if app.state.embedder is None:
        try:
            app.state.embedder = build_embedder(settings)
        except Exception as error:
            logger.error("embedder unavailable (%s) — retrieval will report 'no reliable match'", error)
            app.state.embedder = _BrokenEmbedder()

    app.state.kb = overrides.get("kb")
    if app.state.kb is None:
        try:
            app.state.kb = MongoKBStore(
                database["kb_chunks"] if database is not None else _EmptyCollection(),
                atlas_index=settings.atlas_vector_index,
                atlas_fallback_seconds=settings.atlas_fallback_seconds,
                cache_ttl_seconds=settings.kb_cache_ttl_seconds,
            )
        except Exception:  # pragma: no cover
            app.state.kb = MongoKBStore(_EmptyCollection(), atlas_index=settings.atlas_vector_index)

    # Warm the KB chunk cache in the background so the patient's first real
    # question never pays the cold Atlas read (the warmup itself is
    # best-effort and never raises).
    from app.kb_store import MongoKBStore as _MongoKBStore

    if isinstance(app.state.kb, _MongoKBStore):
        try:
            import asyncio

            asyncio.get_running_loop().create_task(app.state.kb.warmup())
        except RuntimeError:  # no running loop (direct build_state in tests)
            pass

    # --- LLM ---
    # Optional: with no API key the answer path falls back to the local
    # extractive RAG composer (app.answerer) — the Copilot stays fully usable.
    app.state.llm = overrides.get("llm")
    if app.state.llm is None:
        try:
            app.state.llm = ZaiClient(
                api_key=settings.zai_api_key,
                base_url=settings.zai_base_url,
                model=settings.zai_model,
                timeout_seconds=settings.llm_timeout_seconds,
                max_output_tokens=settings.llm_max_output_tokens,
            )
        except LLMError as error:
            logger.error("LLM client unavailable (%s) — answers use the local extractive RAG path", error)
    app.state.llm_model_name = (
        getattr(app.state.llm, "model_name", settings.zai_model) if app.state.llm is not None
        else "local-extractive-rag"
    )

    # --- Safety layer (pattern config + optional Stage-2 model) ---
    app.state.triage = overrides.get("triage")
    stage2_enabled = settings.triage_stage2_enabled and app.state.llm is not None
    if app.state.triage is None:
        app.state.triage = Triage(stage2=app.state.llm, stage2_enabled=stage2_enabled)
    app.state.triage_stage2_enabled = stage2_enabled

    # --- Resilient client to the main backend (the only outbound calls) ---
    app.state.main_client = overrides.get("main_client")
    if app.state.main_client is None:
        app.state.main_client = MainBackendClient(
            settings.main_backend_url,
            connect_timeout=settings.main_connect_timeout,
            total_timeout=settings.main_total_timeout,
            cache_ttl_seconds=settings.context_cache_ttl_seconds,
        )


async def teardown_state(app: FastAPI) -> None:
    try:
        await app.state.main_client.aclose()
    except Exception:  # pragma: no cover
        pass
    if getattr(app.state, "mongo", None) is not None:
        app.state.mongo.close()


def create_app(settings: Settings | None = None, *, include_routes: bool = True) -> FastAPI:
    settings = settings or get_settings()
    setup_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await build_state(app, settings)
        yield
        await teardown_state(app)

    app = FastAPI(
        title="ARIA Recovery Copilot",
        description="Isolated post-discharge conversational assistant (RAG + hard safety layer).",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    if include_routes:
        app.include_router(health.router)
        app.include_router(session.router)
        app.include_router(chat.router)

    # ------------------------------------------------------------------ #
    # Optional single-service deploy: serve the built Copilot SPA from this
    # process (used on Render — one web service, one URL, same-origin /api).
    # Points STATIC_DIR at a directory containing the frontend's `dist`
    # output; when absent (dev) the routes are simply not registered.
    # Registered AFTER the API routers so /api always wins.
    # ------------------------------------------------------------------ #
    static_dir = Path(os.getenv("STATIC_DIR", str(Path(__file__).resolve().parent.parent / "static")))
    if (static_dir / "index.html").exists():
        from fastapi.staticfiles import StaticFiles

        @app.get("/", include_in_schema=False)
        @app.get("/chat", include_in_schema=False)
        async def spa_entry() -> FileResponse:
            return FileResponse(static_dir / "index.html")

        app.mount("/", StaticFiles(directory=static_dir), name="spa")
        logger.info("serving Copilot SPA from %s", static_dir)

    @app.exception_handler(Exception)
    async def calm_failure_handler(request: Request, error: Exception) -> JSONResponse:
        """Spec §2 principle 4: fail loud to logs, fail quiet to the user.
        Never leak a stack trace to a patient."""
        logger.exception("unhandled error on %s %s: %s", request.method, request.url.path, error)
        return JSONResponse(
            status_code=503,
            content={"detail": "Copilot is temporarily unavailable. Your dashboard and care plan are unaffected."},
        )

    return app


app = create_app()
