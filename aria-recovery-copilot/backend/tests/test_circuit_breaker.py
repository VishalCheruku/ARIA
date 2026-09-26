"""Resilience tests for the Copilot -> Main backend boundary (spec §4.3, §11.3).

Automatable cross-system checks:
  - circuit breaker opens after 3 consecutive failures and refuses to call
  - half-open single probe after the reset window; closes on success, re-opens
    on probe failure
  - strict timeouts (2s connect / 4s total) are configured on the client
  - a failing context-summary degrades to the last-known-good cache, and to a
    clean MainBackendError when no cache exists
  - a failing alert POST raises a typed error and never blocks by hanging

The complementary main-side checks (kill the Copilot, dashboard unaffected;
main-backend latency under Copilot load) are covered by
scripts/resilience_smoke.py + docs/TESTING.md manual steps, since they require
both processes running.
"""

import httpx
import pytest

from app.main_client import CircuitBreaker, CircuitOpenError, MainBackendClient, MainBackendError, summary_from_payload
from tests.conftest import MockMainBackend


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def test_breaker_opens_after_three_consecutive_failures():
    clock = FakeClock()
    breaker = CircuitBreaker(failure_threshold=3, reset_seconds=30.0, clock=clock)

    async def boom():
        raise MainBackendError("dead")

    import asyncio

    async def run():
        for _ in range(3):
            with pytest.raises(MainBackendError):
                await breaker.call(boom)
        # 4th attempt must be refused locally, without touching the backend
        with pytest.raises(CircuitOpenError):
            await breaker.call(boom)
        assert breaker.state == "open"

    asyncio.run(run())


def test_breaker_half_open_after_reset_and_closes_on_success():
    import asyncio

    clock = FakeClock()
    breaker = CircuitBreaker(failure_threshold=3, reset_seconds=30.0, clock=clock)

    async def boom():
        raise MainBackendError("dead")

    async def ok():
        return "fine"

    async def run():
        for _ in range(3):
            with pytest.raises(MainBackendError):
                await breaker.call(boom)
        clock.advance(31.0)
        assert breaker.state == "half_open"
        assert await breaker.call(ok) == "fine"
        assert breaker.state == "closed"
        # back to normal operation
        assert await breaker.call(ok) == "fine"

    asyncio.run(run())


def test_breaker_reopens_when_half_open_probe_fails():
    import asyncio

    clock = FakeClock()
    breaker = CircuitBreaker(failure_threshold=3, reset_seconds=30.0, clock=clock)

    async def boom():
        raise MainBackendError("still dead")

    async def run():
        for _ in range(3):
            with pytest.raises(MainBackendError):
                await breaker.call(boom)
        clock.advance(31.0)
        assert breaker.state == "half_open"
        with pytest.raises(MainBackendError):
            await breaker.call(boom)
        assert breaker.state == "open"
        # immediately after, calls are refused again
        with pytest.raises(CircuitOpenError):
            await breaker.call(boom)

    asyncio.run(run())


def test_context_summary_degrades_to_last_known_good_cache():
    backend = MockMainBackend()
    switch = {"fail": False}

    def handler(request: httpx.Request) -> httpx.Response:
        if switch["fail"]:
            return httpx.Response(500, json={"error": "boom"})
        return backend.handler(request)

    client = MainBackendClient("http://main.test", transport=httpx.MockTransport(handler))

    import asyncio

    async def run():
        good = await client.get_context_summary("p1", "token")
        assert good.first_name == "Asha"
        switch["fail"] = True
        degraded = await client.get_context_summary("p1", "token")
        assert degraded.degraded is True
        assert degraded.first_name == "Asha"
        assert degraded.medications == ["Aspirin 75mg daily", "Pantoprazole 40mg daily"]
        # unknown patient has no cache -> clean typed error
        with pytest.raises(MainBackendError):
            await client.get_context_summary("unknown", "token")

    asyncio.run(run())


def test_context_summary_with_no_cache_raises_typed_error():
    backend = MockMainBackend()
    backend.fail_context = True
    client = MainBackendClient("http://main.test", transport=backend.transport())

    import asyncio

    async def run():
        with pytest.raises(MainBackendError):
            await client.get_context_summary("p1", "token")

    asyncio.run(run())


def test_client_uses_strict_timeouts():
    client = MainBackendClient("http://main.test")
    assert client._client.timeout.connect == 2.0
    assert client._client.timeout.read == 4.0
    assert client._client.timeout.write == 4.0
    assert client._client.timeout.pool == 4.0


def test_alert_post_failure_raises_typed_error_not_hang():
    backend = MockMainBackend()
    backend.fail_context = True  # context fails, but alerts route still works in the mock

    def always_500(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "alerts down"})

    client = MainBackendClient("http://main.test", transport=httpx.MockTransport(always_500))

    import asyncio

    async def run():
        payload = {"patient_id": "p1", "source": "copilot", "severity": "high",
                   "reason": "test", "timestamp": "2026-09-26T00:00:00Z"}
        with pytest.raises(MainBackendError):
            await client.post_alert(payload, "token")

    asyncio.run(run())


def test_summary_payload_parsing_is_defensive():
    summary = summary_from_payload({
        "first_name": "Asha",
        "risk_tier": "HIGH",           # tolerated casing
        "primary_diagnosis": "Heart failure",
        "medications": ["Aspirin", None, 42],   # junk tolerated
        "discharge_date": "2026-09-20",
        "known_restrictions": "not a list",     # wrong type -> empty
        "phone": "+911234567890",               # must be DROPPED (spec §8.3)
    })
    assert summary.risk_tier == "High"
    assert summary.medications == ["Aspirin"]
    assert summary.known_restrictions == []
    assert not hasattr(summary, "phone")
    as_dict = summary.as_dict()
    assert set(as_dict) == {"first_name", "risk_tier", "primary_diagnosis",
                            "medications", "discharge_date", "known_restrictions"}
