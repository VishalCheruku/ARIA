# Testing & evaluation (spec §11)

## Backend suites (offline, no Mongo/API keys needed)

```bash
cd backend
.venv/Scripts/python -m pytest tests/ -v
```

| File | Spec | What it proves |
|---|---|---|
| `test_safety_redteam.py` | §11.1 | 46 emergency + 18 safe messages. Emergencies must escalate **with the model classifier actively wrong** — proving the Stage-1 pattern layer alone catches all of them (0 false negatives). Casual/adversarial phrasings ("lol my chest kinda hurts"), fragments, typos, and negations included. Classifier outage and garbage output fail SAFE to emergency. |
| `test_groundedness.py` | §11.2 | 25 factual questions retrieve the correct chunk/category; 6 out-of-scope questions report "no reliable match" instead of guessing; the answer prompt contains the exact retrieved chunks + patient record; every grounded answer carries `sources`; seed data meets the §10 shape (60–120 chunks, 200–500 words, tagged). |
| `test_circuit_breaker.py` | §11.3 | Breaker opens after 3 consecutive failures; half-open single probe after 30s; closes on success / re-opens on probe failure; context-summary degrades to last-known-good cache; strict 2s/4s timeouts configured; alert failures raise typed errors, never hang. |
| `test_endpoints.py` | §8.1, §11.3 | `/api/health`, session start (valid/expired/tampered tokens), SSE chat happy path (meta → deltas → done + sources), emergency chat bypasses the answer path AND posts the alert, no-match path never calls the model, unknown session, main-backend-down → generic greeting, breaker open/half-open across requests, escalation-shown logging. |

**Red-team gate:** the spec requires 0 false negatives before any real deployment.
`test_redteam_false_negative_rate_is_zero` enforces this at suite level. When
`ZAI_API_KEY` is configured, also run the Stage-2 model check live:

```bash
.venv/Scripts/python - <<'PY'
import asyncio
from app.config import get_settings
from app.llm.zai_client import ZaiClient
from app.safety.triage import Triage
from tests.test_safety_redteam import EMERGENCY_STAGE1_CASES, EMERGENCY_MODEL_CASES, SAFE_CASES

async def run():
    llm = ZaiClient(get_settings().zai_api_key, get_settings().zai_base_url, get_settings().zai_model)
    triage = Triage(stage2=llm, stage2_enabled=True)
    missed = []
    for msg in EMERGENCY_STAGE1_CASES + EMERGENCY_MODEL_CASES:
        if not (await triage.classify(msg)).emergency:
            missed.append(msg)
    for msg in SAFE_CASES:  # model may over-triage some safes; log, don't fail
        if (await triage.classify(msg)).emergency:
            print("over-triaged (acceptable):", msg)
    print("LIVE false negatives:", missed or "none")
asyncio.run(run())
PY
```

## Knowledge base seeding + retrieval sanity

```bash
.venv/Scripts/python scripts/seed_kb.py --provider hash   # or zai/local for production
.venv/Scripts/python scripts/create_vector_index.py       # once, on Atlas M10+
curl http://localhost:8000/api/health                     # kb_chunks: 64
```

## Embedded end-to-end (the default run mode)

With the Copilot embedded in the main app (one command, one port):

```bash
npm run build:copilot   # rebuild the Copilot SPA after frontend changes
npm run dev             # main app :5000 spawns the Copilot on :8000 internally
curl http://localhost:5000/health            # copilot.status should be "up"
```

Then the whole patient flow runs over the single origin: register/login →
`POST /api/copilot-token` → open `/copilot/chat?token=…` → the SPA calls
`/copilot/api/session/start` and `/copilot/api/chat` (proxied). An emergency
message must end with `escalation.status = "sent"` and an EventLog row with
`metadata.source = "copilot"` in the main database.

## Cross-system resilience (spec §11.3, needs both processes running)

```bash
# terminal 1: node server/src/index.js            (main ARIA, :5000)
# terminal 2: uvicorn app.main:app --port 8000    (copilot backend)
.venv/Scripts/python scripts/resilience_smoke.py
```

R1 verifies the main dashboard is fine with the Copilot **stopped** (run the
script twice: once with uvicorn up, once with it killed). R2/R3 verify the
Copilot's health surface and clean rejection semantics. The manual
main-backend-timeout check: stop the main backend, click Ask ARIA, open the
copilot link — session start must return a generic greeting within ~5s
(`degraded: true`), never hang. Load-isolation: while load-testing the Copilot
(`uvicorn` + `hey`/`ab`), the main backend's `/health` latency must stay flat —
the per-endpoint rate limits enforce this.

## Main-repo tests

```bash
# from the ARIA repo root
npm test          # node --test; includes test/copilot.routes.test.js (7 tests)
```

Note: one pre-existing failure in `auth.routes.test.js` ("registration stays
disabled until configured" expects the older message "Registration is not
enabled") predates the Copilot work and is unrelated to it.
