"""Resilient client for the ONLY two calls into the main ARIA backend
(spec §4.3, §8.3, §8.4):

  Read  — GET  /api/patients/{id}/context-summary
  Write — POST /api/alerts            (used on escalation)

Wrapper guarantees:
  - strict timeout: 2s connect, 4s total (env-tunable)
  - circuit breaker: opens after 3 consecutive failures, half-open single
    probe after 30s, closes again on success
  - cached last-known-good context summary as fallback for the read, so a
    slow main backend degrades the Copilot's context quality, never crashes it

The dependency direction is Copilot -> Main; nothing here can take the main
app down. Every failure raises MainBackendError and the callers degrade.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional

import httpx

logger = logging.getLogger("aria.copilot.main_client")


class MainBackendError(RuntimeError):
    pass


class CircuitOpenError(MainBackendError):
    pass


class CircuitBreaker:
    """Closed -> (3 consecutive failures) -> Open -> (30s) -> Half-open ->
    single probe -> Closed on success / Open on failure."""

    def __init__(
        self,
        failure_threshold: int = 3,
        reset_seconds: float = 30.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._failure_threshold = failure_threshold
        self._reset_seconds = reset_seconds
        self._clock = clock
        self._state = "closed"
        self._consecutive_failures = 0
        self._opened_at = 0.0
        self._probe_in_flight = False

    @property
    def state(self) -> str:
        if self._state == "open" and self._clock() - self._opened_at >= self._reset_seconds:
            return "half_open"
        return self._state

    def _before_call(self) -> None:
        state = self.state
        if state == "open":
            raise CircuitOpenError("circuit to main backend is open")
        if state == "half_open":
            if self._probe_in_flight:
                raise CircuitOpenError("circuit half-open: probe already in flight")
            self._probe_in_flight = True

    async def call(self, operation: Callable[[], Awaitable[Any]]) -> Any:
        self._before_call()
        try:
            result = await operation()
        except Exception:
            self._record_failure()
            raise
        finally:
            if self.state == "half_open" or self._probe_in_flight:
                self._probe_in_flight = False
        self._record_success()
        return result

    def _record_success(self) -> None:
        self._state = "closed"
        self._consecutive_failures = 0
        self._probe_in_flight = False

    def _record_failure(self) -> None:
        if self.state == "half_open":
            self._trip()
            return
        self._consecutive_failures += 1
        if self._consecutive_failures >= self._failure_threshold:
            self._trip()

    def _trip(self) -> None:
        self._state = "open"
        self._opened_at = self._clock()
        self._consecutive_failures = self._failure_threshold
        logger.error("Circuit to main backend OPENED for %.0fs", self._reset_seconds)


@dataclass(frozen=True)
class ContextSummary:
    """Exactly the fields spec §8.3 permits — nothing more."""
    first_name: str = ""
    risk_tier: str = ""
    primary_diagnosis: str = ""
    medications: list[str] = field(default_factory=list)
    discharge_date: str = ""
    known_restrictions: list[str] = field(default_factory=list)
    degraded: bool = False  # True when served from the last-known-good cache

    def as_dict(self) -> dict:
        return {
            "first_name": self.first_name,
            "risk_tier": self.risk_tier,
            "primary_diagnosis": self.primary_diagnosis,
            "medications": self.medications,
            "discharge_date": self.discharge_date,
            "known_restrictions": self.known_restrictions,
        }


def summary_from_payload(payload: dict) -> ContextSummary:
    def _str(key: str) -> str:
        return str(payload.get(key) or "").strip()

    def _list(key: str) -> list[str]:
        raw = payload.get(key)
        if not isinstance(raw, list):
            return []
        return [str(item).strip() for item in raw if isinstance(item, str) and item.strip()]

    risk = _str("risk_tier").capitalize()
    return ContextSummary(
        first_name=_str("first_name"),
        risk_tier=risk if risk in ("Low", "Medium", "High") else "",
        primary_diagnosis=_str("primary_diagnosis"),
        medications=_list("medications"),
        discharge_date=_str("discharge_date"),
        known_restrictions=_list("known_restrictions"),
    )


class MainBackendClient:
    def __init__(
        self,
        base_url: str,
        *,
        connect_timeout: float = 2.0,
        total_timeout: float = 4.0,
        breaker: Optional[CircuitBreaker] = None,
        cache_ttl_seconds: float = 900.0,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(total_timeout, connect=connect_timeout),
            transport=transport,
        )
        self.breaker = breaker or CircuitBreaker()
        self._cache_ttl = cache_ttl_seconds
        # patient key -> (summary, fetched_at monotonic)
        self._last_known_good: dict[str, tuple[ContextSummary, float]] = {}

    async def aclose(self) -> None:
        await self._client.aclose()

    # ------------------------------------------------------------------ #
    # Read: context-summary (spec §8.3)
    # ------------------------------------------------------------------ #
    async def get_context_summary(self, patient_id: str, copilot_token: str) -> ContextSummary:
        """Raises MainBackendError when unavailable AND no cache exists."""
        try:
            summary = await self.breaker.call(
                lambda: self._fetch_context_summary(patient_id, copilot_token)
            )
            self._last_known_good[patient_id] = (summary, time.monotonic())
            return summary
        except CircuitOpenError:
            return self._cached_or_raise(patient_id, "circuit open")
        except MainBackendError:
            return self._cached_or_raise(patient_id, "main backend call failed")
        except Exception as error:  # httpx errors, timeouts
            return self._cached_or_raise(patient_id, f"main backend call error: {error}")

    async def _fetch_context_summary(self, patient_id: str, copilot_token: str) -> ContextSummary:
        try:
            response = await self._client.get(
                f"/api/patients/{patient_id}/context-summary",
                headers={"Authorization": f"Bearer {copilot_token}"},
            )
        except httpx.HTTPError as error:
            raise MainBackendError(f"context-summary transport error: {error}") from error
        if response.status_code >= 500:
            raise MainBackendError(f"context-summary returned HTTP {response.status_code}")
        if response.status_code == 404:
            raise MainBackendError("context-summary returned 404 (unknown patient)")
        if response.status_code >= 400:
            raise MainBackendError(f"context-summary returned HTTP {response.status_code}")
        try:
            return summary_from_payload(response.json())
        except ValueError as error:
            raise MainBackendError(f"context-summary returned invalid JSON: {error}") from error

    def _cached_or_raise(self, patient_id: str, cause: str) -> ContextSummary:
        cached = self._last_known_good.get(patient_id)
        if cached and time.monotonic() - cached[1] <= self._cache_ttl:
            logger.warning("context-summary degraded to last-known-good cache (%s)", cause)
            stale = cached[0]
            return ContextSummary(**{**stale.as_dict(), "degraded": True})
        raise MainBackendError(f"main backend unavailable and no cached context ({cause})")

    # ------------------------------------------------------------------ #
    # Write: alerts (spec §8.4) — the ONLY write into the main system
    # ------------------------------------------------------------------ #
    async def post_alert(self, payload: dict, copilot_token: str) -> str:
        """Returns the main-app alert id. Raises MainBackendError on failure;
        callers must treat a failed alert POST as loggable but non-fatal for
        the patient conversation."""
        async def _do() -> str:
            try:
                response = await self._client.post(
                    "/api/alerts",
                    json=payload,
                    headers={"Authorization": f"Bearer {copilot_token}"},
                )
            except httpx.HTTPError as error:
                raise MainBackendError(f"alerts transport error: {error}") from error
            if response.status_code >= 400:
                raise MainBackendError(f"alerts returned HTTP {response.status_code}: {response.text[:200]}")
            try:
                return str(response.json().get("alert_id") or "")
            except ValueError as error:
                raise MainBackendError(f"alerts returned invalid JSON: {error}") from error

        return await self.breaker.call(_do)


async def wait_for(coro, timeout: float, label: str):
    """Small helper: run with a hard cap so a hung main backend can never hang
    a patient-facing request (spec §2 principle 4)."""
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except asyncio.TimeoutError as error:
        raise MainBackendError(f"{label} timed out after {timeout}s") from error
