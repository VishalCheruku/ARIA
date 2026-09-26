"""MongoDB access for the Copilot's OWN database `aria_copilot` (spec §7).

Collections: kb_chunks, conversations, messages, escalations.
NEVER touches the main app's database. PHI-adjacent handling:
  - conversations store only a hashed/opaque patient_token_id, never the raw
    patient id
  - the raw patient JWT is held in memory only (session cache) so the Copilot
    can call the two main-backend endpoints; it is never persisted

If Mongo is unreachable the Copilot still boots and serves /api/health; the
chat/session routes answer with the calm unavailable message (spec §2
principle 4: fail loud to logs, fail quiet to the user).
"""

from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional, Protocol

logger = logging.getLogger("aria.copilot.db")


class StoreUnavailable(RuntimeError):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def hash_token_id(patient_id: str) -> str:
    """Opaque, non-reversible conversation key (spec §7: 'hashed/opaque,
    never the raw patient_id if avoidable')."""
    return hashlib.sha256(f"aria-copilot:{patient_id}".encode("utf-8")).hexdigest()[:24]


# --------------------------------------------------------------------------- #
# Store interfaces
# --------------------------------------------------------------------------- #
@dataclass
class Conversation:
    session_id: str
    patient_token_id: str
    started_at: datetime
    last_message_at: datetime
    status: str = "active"
    escalated: bool = False


class ConversationStore(Protocol):
    async def create_conversation(self, patient_id: str) -> Conversation: ...
    async def get_conversation(self, session_id: str) -> Optional[Conversation]: ...
    async def mark_escalated(self, session_id: str) -> None: ...
    async def add_message(self, session_id: str, role: str, text: str, *, retrieved_chunk_ids=None,
                          flagged_emergency: bool = False) -> str: ...
    async def get_messages(self, session_id: str, limit: int = 20) -> list[dict]: ...
    async def record_escalation(self, session_id: str, message_id: str, detected_signal: str,
                                main_app_alert_id: str) -> str: ...
    async def close(self) -> None: ...


class MemoryConversationStore:
    """In-process store used in tests and as a dev fallback when Mongo is down.
    Deliberately per-process only — no shared runtime state with anything else
    (spec §4.4)."""

    def __init__(self) -> None:
        self._conversations: dict[str, Conversation] = {}
        self._messages: dict[str, list[dict]] = {}
        self._escalations: list[dict] = []
        self._counter = 0

    def _next_id(self, prefix: str) -> str:
        self._counter += 1
        return f"{prefix}-{self._counter:06d}"

    async def create_conversation(self, patient_id: str) -> Conversation:
        session_id = self._next_id("sess")
        now = utc_now()
        convo = Conversation(session_id=session_id, patient_token_id=hash_token_id(patient_id),
                             started_at=now, last_message_at=now)
        self._conversations[session_id] = convo
        self._messages[session_id] = []
        return convo

    async def get_conversation(self, session_id: str) -> Optional[Conversation]:
        return self._conversations.get(session_id)

    async def mark_escalated(self, session_id: str) -> None:
        convo = self._conversations.get(session_id)
        if convo:
            convo.escalated = True

    async def add_message(self, session_id: str, role: str, text: str, *, retrieved_chunk_ids=None,
                          flagged_emergency: bool = False) -> str:
        message_id = self._next_id("msg")
        bucket = self._messages.setdefault(session_id, [])
        bucket.append({
            "id": message_id,
            "role": role,
            "text": text,
            "retrieved_chunk_ids": list(retrieved_chunk_ids or []),
            "flagged_emergency": flagged_emergency,
            "created_at": utc_now().isoformat(),
        })
        convo = self._conversations.get(session_id)
        if convo:
            convo.last_message_at = utc_now()
        return message_id

    async def get_messages(self, session_id: str, limit: int = 20) -> list[dict]:
        return list(self._messages.get(session_id, [])[-limit:])

    async def record_escalation(self, session_id: str, message_id: str, detected_signal: str,
                                main_app_alert_id: str) -> str:
        escalation_id = self._next_id("esc")
        self._escalations.append({
            "id": escalation_id,
            "conversation_id": session_id,
            "message_id": message_id,
            "detected_signal": detected_signal,
            "main_app_alert_id": main_app_alert_id,
            "created_at": utc_now().isoformat(),
        })
        return escalation_id

    async def close(self) -> None:  # pragma: no cover
        return None


class MongoConversationStore:
    def __init__(self, database) -> None:
        self._db = database
        self._conversations = database["conversations"]
        self._messages = database["messages"]
        self._escalations = database["escalations"]

    async def ensure_indexes(self) -> None:
        await self._conversations.create_index("patient_token_id")
        await self._messages.create_index([("conversation_id", 1), ("created_at", 1)])
        await self._escalations.create_index("conversation_id")

    async def create_conversation(self, patient_id: str) -> Conversation:
        result = await self._conversations.insert_one({
            "patient_token_id": hash_token_id(patient_id),
            "started_at": utc_now(),
            "last_message_at": utc_now(),
            "status": "active",
            "escalated": False,
        })
        session_id = str(result.inserted_id)
        return Conversation(session_id=session_id, patient_token_id=hash_token_id(patient_id),
                            started_at=utc_now(), last_message_at=utc_now())

    async def get_conversation(self, session_id: str) -> Optional[Conversation]:
        try:
            from bson import ObjectId
            doc = await self._conversations.find_one({"_id": ObjectId(session_id)})
        except Exception:
            return None
        if not doc:
            return None
        return Conversation(
            session_id=str(doc["_id"]),
            patient_token_id=doc.get("patient_token_id", ""),
            started_at=doc.get("started_at") or utc_now(),
            last_message_at=doc.get("last_message_at") or utc_now(),
            status=doc.get("status", "active"),
            escalated=bool(doc.get("escalated")),
        )

    async def mark_escalated(self, session_id: str) -> None:
        await self._update_conversation(session_id, {"escalated": True})

    async def _update_conversation(self, session_id: str, update: dict) -> None:
        from bson import ObjectId
        try:
            await self._conversations.update_one(
                {"_id": ObjectId(session_id)}, {"$set": {**update, "last_message_at": utc_now()}}
            )
        except Exception as error:
            logger.error("conversation update failed: %s", error)
            raise StoreUnavailable("conversation update failed") from error

    async def add_message(self, session_id: str, role: str, text: str, *, retrieved_chunk_ids=None,
                          flagged_emergency: bool = False) -> str:
        from bson import ObjectId
        try:
            inserted = await self._messages.insert_one({
                "conversation_id": session_id,
                "role": role,
                "text": text,
                "retrieved_chunk_ids": [chunk_id for chunk_id in (retrieved_chunk_ids or [])],
                "flagged_emergency": flagged_emergency,
                "created_at": utc_now(),
            })
            await self._conversations.update_one(
                {"_id": ObjectId(session_id)}, {"$set": {"last_message_at": utc_now()}}
            )
            return str(inserted.inserted_id)
        except Exception as error:
            logger.error("message persist failed: %s", error)
            raise StoreUnavailable("message persist failed") from error

    async def get_messages(self, session_id: str, limit: int = 20) -> list[dict]:
        try:
            docs = await self._messages.find({"conversation_id": session_id}) \
                .sort("created_at", 1).to_list(length=limit * 4)
            recent = docs[-limit:]
            return [{
                "id": str(doc["_id"]),
                "role": doc.get("role", "user"),
                "text": doc.get("text", ""),
                "retrieved_chunk_ids": [str(value) for value in doc.get("retrieved_chunk_ids") or []],
                "flagged_emergency": bool(doc.get("flagged_emergency")),
                "created_at": (doc.get("created_at") or utc_now()).isoformat(),
            } for doc in recent]
        except Exception as error:
            logger.error("message load failed: %s", error)
            raise StoreUnavailable("message load failed") from error

    async def record_escalation(self, session_id: str, message_id: str, detected_signal: str,
                                main_app_alert_id: str) -> str:
        try:
            inserted = await self._escalations.insert_one({
                "conversation_id": session_id,
                "message_id": message_id,
                "detected_signal": detected_signal,
                "main_app_alert_id": main_app_alert_id,
                "created_at": utc_now(),
            })
            return str(inserted.inserted_id)
        except Exception as error:
            logger.error("escalation persist failed: %s", error)
            raise StoreUnavailable("escalation persist failed") from error

    async def close(self) -> None:  # pragma: no cover
        return None
