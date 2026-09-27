#!/usr/bin/env python
"""Seed the Copilot's knowledge base (spec §10, §12 step 2).

Usage (from backend/):
    .venv/Scripts/python scripts/seed_kb.py                 # provider from env
    .venv/Scripts/python scripts/seed_kb.py --provider hash # offline dev
    .venv/Scripts/python scripts/seed_kb.py --drop          # wipe kb_chunks first

What it does:
  1. connects to MONGODB_URI and selects the MONGODB_DB database (`aria_copilot`)
  2. fits + computes embeddings for every seed chunk (title+tags+text)
  3. upserts kb_chunks keyed on source_title (re-running updates embeddings)
  4. when the provider is the lexical one, saves the IDF table so the API can
     embed queries with the same weighting
  5. prints counts per category

Re-seeding is REQUIRED whenever EMBEDDING_PROVIDER / EMBEDDING_MODEL /
EMBEDDING_DIMENSIONS change — the store refuses to mix embedding spaces.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def load_env_file(path: Path) -> None:
    """Minimal KEY=VALUE loader (no dotenv dependency). Existing env wins."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


# Load the main repo's .env (two levels up: backend/scripts -> backend -> module -> repo root)
# and the backend's own .env so `--provider` isn't needed to reach the right database.
_module_root = Path(__file__).resolve().parent.parent
load_env_file(_module_root.parent.parent / ".env")
load_env_file(_module_root / ".env")

from app.config import Settings  # noqa: E402
from app.embeddings import build_embedder, embed_text_for_record  # noqa: E402
from seed import all_chunks  # noqa: E402


async def main() -> int:
    parser = argparse.ArgumentParser(description="Seed the aria_copilot knowledge base")
    parser.add_argument("--drop", action="store_true", help="delete existing kb_chunks before seeding")
    parser.add_argument("--provider", choices=["zai", "local", "hash"], help="override EMBEDDING_PROVIDER")
    args = parser.parse_args()

    env_overrides = {}
    if args.provider:
        os.environ["EMBEDDING_PROVIDER"] = args.provider

    settings = Settings(**env_overrides)

    from motor.motor_asyncio import AsyncIOMotorClient

    client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    database = client[settings.mongodb_db]
    try:
        await database.command("ping")
    except Exception as error:
        print(f"ERROR: cannot reach MongoDB at {settings.mongodb_uri}: {error}")
        return 1

    chunks = database["kb_chunks"]
    if args.drop:
        await chunks.delete_many({})
        print("dropped existing kb_chunks")

    records = all_chunks()
    print(f"embedding {len(records)} chunks with provider '{settings.embedding_provider}' ...")

    embedder = build_embedder(settings)
    lexical = bool(getattr(embedder, "is_lexical", False))
    texts = [embed_text_for_record(record, lexical=lexical) for record in records]
    if lexical and hasattr(embedder, "fit_records"):
        await embedder.fit_records(texts)
    vectors = await embedder.embed(texts)

    now = datetime.now(timezone.utc)
    replaced = 0
    for record, vector in zip(records, vectors):
        await chunks.replace_one(
            {"source_title": record.source_title},
            {
                "source_title": record.source_title,
                "source_type": record.source_type,
                "category": record.category,
                "text": record.text,
                "tags": record.tags,
                "embedding": vector,
                "embedding_model": embedder.name,
                "embedding_dim": embedder.dimensions,
                "created_at": now,
                "updated_at": now,
            },
            upsert=True,
        )
        replaced += 1

    if lexical and hasattr(embedder, "save_idf"):
        idf_path = os.getenv(
            "LEXICAL_IDF_PATH",
            str(Path(__file__).resolve().parent.parent / "data" / "lexical_idf.json"),
        )
        embedder.save_idf(idf_path)
        print(f"lexical IDF table saved to {idf_path}")

    print(f"\nseeded {replaced} chunks into {settings.mongodb_db}.kb_chunks")
    pipeline = [{"$group": {"_id": "$category", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    async for row in chunks.aggregate(pipeline):
        print(f"  {row['_id']:12} {row['count']}")
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
