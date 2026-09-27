"""Small-talk layer + upgraded deferral (added with the embedded Ask ARIA
experience): greetings/thanks/identity/acknowledgments must get warm replies
instead of the RAG deferral, and off-KB questions must defer WITH topic
suggestions from the below-threshold neighbours."""

from __future__ import annotations

import pytest

from app.kb_store import ChunkResult
from app.main_client import ContextSummary
from app.retrieval import retrieve
from app.smalltalk import smalltalk_reply_for, suggestion_suffix


def _summary(first_name: str = "") -> ContextSummary:
    return ContextSummary(
        first_name=first_name, risk_tier="", primary_diagnosis="",
        medications=[], discharge_date="", known_restrictions=[],
    )


# ---------------------------------------------------------------- greetings
@pytest.mark.parametrize("message", ["hello", "Hello!", "HI", "hiii", "hey", "hey there",
                                     "good morning", "Good Evening!", "hello aria", "namaste"])
def test_greetings_get_a_warm_reply(message):
    reply = smalltalk_reply_for(message, None)
    # the essence: a greeting NEVER lands in the RAG deferral
    assert reply and "don't have reliable information" not in reply


def test_greeting_uses_patient_name_when_known():
    reply = smalltalk_reply_for("hello", _summary("Vishal"))
    assert "Vishal" in reply


# ------------------------------------------------------------------- thanks
@pytest.mark.parametrize("message", ["thanks", "thank you", "Thank you so much!", "thx", "ty"])
def test_thanks_get_a_reply(message):
    reply = smalltalk_reply_for(message, None)
    assert reply and "don't have reliable information" not in reply


# ---------------------------------------------------------------- identity
@pytest.mark.parametrize("message", ["who are you", "what are you", "what's your name",
                                     "are you a robot", "are you a doctor?",
                                     "what can you do", "how do you work", "help"])
def test_identity_questions_get_capability_reply(message):
    reply = smalltalk_reply_for(message, None)
    assert reply and "I'm ARIA" in reply


# ------------------------------------------------------------ acknowledgments
@pytest.mark.parametrize("message", ["ok", "okay", "nice", "great", "yes", "no", "got it", "hmm"])
def test_acknowledgments_prompt_for_a_topic(message):
    reply = smalltalk_reply_for(message, None)
    assert reply and "don't have reliable information" not in reply


# ------------------------------------------------------- NOT small talk — RAG
@pytest.mark.parametrize("message", [
    "hello, can you help with my wound dressing?",
    "hi I have chest pain",
    "what foods should I avoid?",
    "how often should I change my dressing",
    "tell me about my medicines please",
    "hello world this is a very long sentence that is clearly a real question",
])
def test_real_questions_are_never_smalltalk(message):
    assert smalltalk_reply_for(message, None) is None


def test_replies_are_deterministic_per_message():
    assert smalltalk_reply_for("hello", None) == smalltalk_reply_for("hello", None)
    assert smalltalk_reply_for("hi", None) == smalltalk_reply_for("hi", None)


# ------------------------------------------------- suggestion suffix (deferral)
def _chunk(category: str, score: float = 0.1) -> ChunkResult:
    return ChunkResult(id=f"c-{category}", source_title="T", source_type="kb",
                       category=category, text="text", tags=[], score=score)


def test_no_near_misses_falls_back_to_default_topics():
    suffix = suggestion_suffix([])
    assert suffix.startswith(" In the meantime")
    assert "wound care" in suffix


def test_near_misses_become_topic_suggestions():
    suffix = suggestion_suffix([_chunk("wound"), _chunk("diet"), _chunk("medication")])
    assert suffix.startswith(" In the meantime")
    assert "wound care" in suffix and "food and drink" in suffix and "your medicines" in suffix


def test_suggestion_suffix_dedupes_and_caps_at_three():
    suffix = suggestion_suffix([_chunk("wound"), _chunk("wound"), _chunk("diet"),
                                _chunk("medication"), _chunk("activity")])
    assert suffix.count("wound care") == 1
    assert "activity and rest" not in suffix  # capped at 3 topics


def test_unknown_near_miss_categories_fall_back_too():
    assert suggestion_suffix([_chunk("weird_category")]) == suggestion_suffix([])


# ------------------------------------- retrieval integration: near-miss carry
@pytest.mark.asyncio
async def test_unreliable_retrieval_keeps_near_misses_for_suggestions(kb, embedder):
    result = await retrieve("What is the capital of France?", embedder, kb,
                            top_k=5, threshold=0.72, embedder_is_lexical=True)
    assert not result.reliable
    assert result.chunks == []
    # the below-threshold neighbours feed the topic suggestions
    suffix = suggestion_suffix(result.near_misses)
    assert suffix == "" or "In the meantime" in suffix


@pytest.mark.asyncio
async def test_lexical_embedder_sets_prefer_fallback_flag(kb, embedder):
    """The lexical embedder skips Atlas entirely (hash vectors are meaningless
    there) — the store receives prefer_fallback=True."""
    calls = []

    class SpyStore:
        async def search(self, query_embedding, query_model, top_k, categories=None,
                         query_text="", *, prefer_fallback=False):
            calls.append(prefer_fallback)
            return await kb.search(query_embedding, query_model, top_k, categories,
                                   query_text, prefer_fallback=prefer_fallback)
        async def count(self):
            return await kb.count()

    await retrieve("How often should I change my dressing?", embedder, SpyStore(),
                   top_k=5, threshold=0.72, embedder_is_lexical=True)
    assert calls and all(calls), f"expected prefer_fallback=True on every search, got {calls}"
