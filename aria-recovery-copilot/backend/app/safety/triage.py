"""ARIA Recovery Copilot — safety / escalation layer (spec §9).

This runs BEFORE retrieval and BEFORE any answer is generated, on every
incoming user message. It is the most important logic in this module.

Two-stage detection (spec §9.1):
  Stage 1 — fast pattern check against `emergency_patterns.yaml`.
  Stage 2 — a dedicated, narrow GLM classification call (separate from the
            conversational answer path), used only when Stage 1 does not fire.

Failure semantics:
  - If Stage 2 errors, times out, or returns garbage, the message is treated
    as an EMERGENCY (fail-safe over-triage — under-triaging is worse).
  - Stage 1 has no failure mode that can miss a message: on any error loading
    or applying patterns, the module re-raises loudly at construction time and
    classify() falls through to the fail-safe Stage 2 behavior.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Awaitable, Callable, Protocol

import yaml

logger = logging.getLogger("aria.copilot.safety")

PATTERNS_PATH = Path(__file__).with_name("emergency_patterns.yaml")

# Spec §9.2 — used verbatim.
SAFETY_CLASSIFIER_PROMPT = """You are a safety triage classifier for a post-discharge patient chat \
system. You are NOT answering the patient. Your only job is to decide if \
their message describes a potential medical emergency that needs \
immediate human/emergency-service attention.

Classify as EMERGENCY if the message describes, even ambiguously:
- chest pain, pressure, or tightness
- trouble breathing or shortness of breath
- uncontrolled or heavy bleeding
- sudden confusion, fainting, or loss of consciousness
- one-sided weakness, slurred speech, or facial drooping
- signs of severe allergic reaction (swelling of face/throat, hives with \
breathing difficulty)
- thoughts of self-harm or suicide
- any statement that a caregiver would reasonably act on immediately

When uncertain, classify as EMERGENCY. Under-triaging is worse than \
over-triaging.

Respond ONLY in this exact JSON shape, nothing else:
{"emergency": true|false, "reason": "<one short phrase>"}"""


class Stage2Classifier(Protocol):
    """Anything that can run the Stage-2 model check (the GLM client in prod,
    a deterministic fake in tests)."""

    async def classify_emergency(self, message: str) -> dict: ...


@dataclass(frozen=True)
class TriageResult:
    emergency: bool
    stage: int | None = None  # 1 = pattern hit, 2 = model classifier, None = fail-safe
    category: str | None = None
    signal: str = ""          # short description for the escalation log — never raw message text
    reason: str = ""
    matched_pattern: str | None = field(default=None, repr=False)


def _collapse_elongation(text: str) -> str:
    """'sooooo' -> 'soo', 'pleeease' -> 'pleease'. Cheap typo tolerance for
    the pattern layer; over-matching here is safe because patterns still
    require clinical keywords."""
    return re.sub(r"(.)\1{2,}", r"\1\1", text)


class Triage:
    def __init__(
        self,
        patterns_path: Path = PATTERNS_PATH,
        stage2: Stage2Classifier | None = None,
        stage2_enabled: bool = True,
    ) -> None:
        self._patterns_path = patterns_path
        self._stage2 = stage2
        self._stage2_enabled = stage2_enabled
        self._categories: list[tuple[str, str, list[re.Pattern[str]]]] = []
        self._negation_patterns: list[re.Pattern[str]] = []
        self.reload()

    def reload(self) -> None:
        """Re-read the YAML so patterns can be extended without code changes."""
        raw = yaml.safe_load(self._patterns_path.read_text(encoding="utf-8"))
        categories = []
        for name, spec in (raw.get("categories") or {}).items():
            label = str((spec or {}).get("label") or name)
            compiled = []
            for pattern in (spec or {}).get("patterns") or []:
                try:
                    compiled.append(re.compile(pattern, re.IGNORECASE))
                except re.error:
                    # A broken pattern must never take the safety layer down;
                    # skip it loudly so review picks it up.
                    logger.error("Invalid emergency pattern in %s [%s]: %r", self._patterns_path.name, name, pattern)
            if compiled:
                categories.append((name, label, compiled))
        if not categories:
            raise RuntimeError(f"Emergency pattern file {self._patterns_path} produced no usable categories")
        negations = []
        for pattern in (raw.get("negation_guard") or {}).get("prefixes") or []:
            try:
                negations.append(re.compile(pattern, re.IGNORECASE))
            except re.error:
                logger.error("Invalid negation-guard pattern: %r", pattern)
        self._categories = categories
        self._negation_patterns = negations
        logger.info("Safety patterns loaded: %d categories", len(self._categories))

    # ------------------------------------------------------------------ #
    # Stage 1
    # ------------------------------------------------------------------ #
    def _stage1_match(self, message: str) -> tuple[str, str, re.Pattern[str]] | None:
        texts = [message, _collapse_elongation(message)]
        hits: list[tuple[str, str, re.Pattern[str]]] = []
        for name, label, patterns in self._categories:
            for pattern in patterns:
                if any(pattern.search(text) for text in texts):
                    hits.append((name, label, pattern))
                    break
        if not hits:
            return None
        # Negation guard: when the ONLY hit is a category whose phrase appears
        # inside a leading negation ("no chest pain", "denies fever"), treat as
        # non-emergency. Any other configuration stays an emergency.
        if len(hits) == 1 and self._message_negates_only_hit(message):
            return None
        name, label, pattern = hits[0]
        return name, label, pattern

    def _message_negates_only_hit(self, message: str) -> bool:
        stripped = message.strip().lower()
        for neg in self._negation_patterns:
            if neg.match(stripped):
                return True
        return False

    # ------------------------------------------------------------------ #
    # Full classification
    # ------------------------------------------------------------------ #
    async def classify(self, message: str) -> TriageResult:
        match = self._stage1_match(message)
        if match:
            name, label, pattern = match
            return TriageResult(
                emergency=True,
                stage=1,
                category=name,
                signal=label,
                reason=f"matched emergency pattern in category '{name}'",
                matched_pattern=pattern.pattern,
            )

        if self._stage2_enabled and self._stage2 is not None:
            try:
                verdict = await self._stage2.classify_emergency(message)
                emergency = bool(verdict.get("emergency"))
                reason = str(verdict.get("reason") or "")[:160]
                if emergency:
                    return TriageResult(
                        emergency=True,
                        stage=2,
                        category="model_classifier",
                        signal="model classifier flagged potential emergency",
                        reason=reason,
                    )
                return TriageResult(emergency=False, stage=2, reason=reason or "model classifier: no emergency")
            except Exception:
                # Fail-safe: if the safety model cannot be reached, treat the
                # message as an emergency (over-triage beats under-triage).
                logger.exception("Stage-2 safety classifier failed — failing safe to EMERGENCY")
                return TriageResult(
                    emergency=True,
                    stage=None,
                    category="classifier_unavailable_failsafe",
                    signal="safety classifier unavailable — treated as emergency (fail-safe)",
                    reason="stage-2 classifier error; fail-safe over-triage",
                )

        return TriageResult(emergency=False, stage=None, reason="stage 2 disabled; no stage-1 match")


def parse_classifier_json(raw: str) -> dict:
    """Tolerant parse of the classifier's `{"emergency": ..., "reason": ...}`
    output. Models occasionally wrap JSON in prose or code fences."""
    text = (raw or "").strip()
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(0))
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
    raise ValueError(f"Classifier returned non-JSON output: {text[:200]!r}")
