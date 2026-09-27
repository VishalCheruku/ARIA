"""Small-talk layer — greetings, thanks, goodbyes, identity, acknowledgments.

The grounded RAG contract (spec §8.2/§9.4) covers recovery questions only:
retrieving "hello" matches nothing, and the honest deferral ("I don't have
reliable information on that…") reads as robotic to a greeting — the patient
feeling ignored is exactly the wrong first impression for a care companion.

These replies carry NO medical content, so answering them from templates keeps
the grounding guarantee intact for everything that IS medical. Safety always
runs first: chat.py calls this only AFTER the triage gate, and every pattern
below is a full-match on short messages, so "hi, I have chest pain" can never
land here — it flows to triage and the emergency path as usual.
"""

from __future__ import annotations

import re
from typing import Optional, Sequence

from app.kb_store import ChunkResult
from app.main_client import ContextSummary

# Full-message patterns — anything longer or more specific goes to retrieval.
_GREETING_RE = re.compile(
    r"""^\s*
        (?:hi+|hello+|hey+|hiya|howdy|yo+
          |good\s*(?:morning|afternoon|evening|day)
          |namaste|greetings?
        )
        (?:\s+(?:aria|there))?\s*[!?,.\s]*$""",
    re.I | re.X,
)

_THANKS_RE = re.compile(
    r"""^\s*(?:thanks?|thank\s*you|thankyou|thx|ty|tyvm
          |(?:thanks?|thank\s*you)\s+(?:so\s+much|a\s+lot|very\s+much)
          |much\s+appreciated|appreciate\s+it
        )\s*[\s!,.?]*$""",
    re.I | re.X,
)

_AFFIRM_RE = re.compile(
    r"""^\s*(?:k|kk|ok(?:ay)?|alright|aright|great|awesome|nice|cool|good|fine
          |yes|yeah|yep|nope|no|sure|got\s*it|i\s*see|oh\s*k(?:ay)?|hmm+|hm+)\s*[\s!,.?]*$""",
    re.I | re.X,
)

_BYE_RE = re.compile(
    r"""^\s*(?:bye+|goodbye|good\s*night|see\s*(?:you|ya)|take\s*care|cheers)\s*[\s!,.?]*$""",
    re.I | re.X,
)

_IDENTITY_RE = re.compile(
    r"""^\s*(?:
          who\s+are\s+you | what\s+are\s+you | what'?s\s+your\s+name | your\s+name
        | are\s+you\s+(?:a\s+)?(?:bot|robot|ai|human|real|doctor|nurse|person|real\s+person)
        | what\s+can\s+you\s+(?:do|help)(?:\s+with)?
        | how\s+(?:do|can)\s+you\s+help(?:\s+me)?
        | how\s+do\s+you\s+work
        | what\s+is\s+aria
        | help
        )\s*[!?,.]*$""",
    re.I | re.X,
)

_MAX_SMALLTALK_WORDS = 8

_GREETINGS = (
    "Hello{name}! I'm ARIA, your recovery assistant. Ask me anything about your recovery — medicines, wound care, food and drink, activity, or warning signs to watch for.",
    "Hi{name}! Great to see you. I can answer questions about your recovery — what would you like to know?",
    "Hey{name}! I'm here and ready — whether it's about your medicines, your wound, or how you should be feeling this week.",
)

_THANKS_REPLIES = (
    "You're very welcome{name}! I'm here whenever you have another question about your recovery.",
    "Happy to help{name}! Remember you can check in with me any time.",
)

_BYES = (
    "Take care{name}! I'm here any time you need me.",
    "Goodbye{name} — look after yourself, and come back with any questions.",
)

_IDENTITY_REPLY = (
    "I'm ARIA, the recovery assistant on your dashboard. I answer from your care "
    "instructions — things like medicines, wound care, food and drink, activity and "
    "rest, and the warning signs to watch for. I can't diagnose or prescribe, and for "
    "anything urgent you should call your care team or emergency services."
)

_PROMPT_REPLY = (
    "Is there anything about your recovery I can help with — medicines, wound care, "
    "food and drink, activity, or warning signs to watch for?"
)


def _pick(message: str, options: Sequence[str]) -> str:
    """Deterministic, message-stable pick so the same input always gets the
    same reply (no flicker on retries)."""
    return options[sum(ord(char) for char in message[:32]) % len(options)]


def smalltalk_reply_for(message: str, summary: Optional[ContextSummary]) -> Optional[str]:
    """The small-talk reply for this message, or None if it is not small talk."""
    text = (message or "").strip()
    if not text or len(text.split()) > _MAX_SMALLTALK_WORDS:
        return None

    first = (summary.first_name if summary else "") or ""
    name = f", {first}" if first else ""

    if _IDENTITY_RE.fullmatch(text):
        return _IDENTITY_REPLY
    if _GREETING_RE.fullmatch(text):
        return _pick(text, _GREETINGS).format(name=name)
    if _BYE_RE.fullmatch(text):
        return _pick(text, _BYES).format(name=name)
    if _THANKS_RE.fullmatch(text):
        return _pick(text, _THANKS_REPLIES).format(name=name)
    if _AFFIRM_RE.fullmatch(text):
        return _PROMPT_REPLY
    return None


# --------------------------------------------------------------------------- #
# Off-KB deferral upgrades — near-miss chunks become topic suggestions
# --------------------------------------------------------------------------- #
_TOPIC_LABELS = {
    "medication": "your medicines",
    "diet": "food and drink",
    "activity": "activity and rest",
    "wound": "wound care",
    "red_flags": "warning signs after surgery",
    "faq": "reaching your care team",
    "process": "how ARIA monitors your recovery",
}

_SUGGESTION_LIMIT = 3

# Shown when retrieval found nothing usable at all (no near-miss categories):
# the deferral still ends with somewhere to go instead of a dead end.
_DEFAULT_TOPICS = ("your medicines", "wound care", "food and drink")


def suggestion_suffix(near_misses: Sequence[ChunkResult]) -> str:
    """A friendly "...I can help with X, Y, Z" line built from the categories of
    the nearest below-threshold chunks — falling back to the KB's broad topics
    when nothing usable was retrieved at all."""
    labels: list[str] = []
    for chunk in near_misses:
        label = _TOPIC_LABELS.get((chunk.category or "").strip())
        if label and label not in labels:
            labels.append(label)
        if len(labels) >= _SUGGESTION_LIMIT:
            break
    if not labels:
        labels = list(_DEFAULT_TOPICS)
    if len(labels) == 1:
        listing = labels[0]
    else:
        listing = ", ".join(labels[:-1]) + " or " + labels[-1]
    return f" In the meantime, I can help with things like {listing}."
