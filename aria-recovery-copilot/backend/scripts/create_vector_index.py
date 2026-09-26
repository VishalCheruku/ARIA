#!/usr/bin/env python
"""Create the Atlas Vector Search index on `aria_copilot.kb_chunks` (spec §5).

Run ONCE per Atlas cluster after seeding (from backend/):
    .venv/Scripts/python scripts/create_vector_index.py

Requires MONGODB_URI pointing at an Atlas cluster with Vector Search support
(M10+). If the index already exists it is left untouched. The Copilot works
without this index — the store falls back to an in-process cosine scan — but
Atlas Vector Search is the production path.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import Settings  # noqa: E402

INDEX_DEFINITION = {
    "fields": [
        {
            "type": "vector",
            "path": "embedding",
            "numDimensions": int(os.getenv("EMBEDDING_DIMENSIONS", "1024")),
            "similarity": "cosine",
        },
        {"type": "filter", "path": "category"},
    ]
}


def main() -> int:
    settings = Settings()
    from pymongo import MongoClient

    client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    database = client[settings.mongodb_db]
    collection = database["kb_chunks"]
    name = settings.atlas_vector_index

    existing = {index["name"] for index in collection.list_search_indexes()}
    if name in existing:
        print(f"search index '{name}' already exists on {settings.mongodb_db}.kb_chunks")
        return 0

    try:
        collection.create_search_index(
            {"name": name, "type": "vectorSearch", "definition": INDEX_DEFINITION}
        )
    except Exception as error:
        print(f"ERROR creating search index (Atlas Vector Search required, M10+): {error}")
        return 1
    print(f"created search index '{name}':")
    print(json.dumps(INDEX_DEFINITION, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
