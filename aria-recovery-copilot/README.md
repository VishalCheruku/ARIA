# ARIA Recovery Copilot

A **standalone, isolated module** for the ARIA post-discharge monitoring platform: a
conversational assistant a discharged patient (or caregiver) opens from a single
"Ask ARIA" button on the dashboard. It answers questions about *that patient's own*
discharge instructions, medications, diet, activity limits, and red-flag symptoms —
grounded in a curated knowledge base (retrieval, never free-form guessing), with a
hard safety layer that escalates instead of answering when it detects an emergency.

Built from `ARIA_Recovery_Copilot_Build_Spec.md`. If this module goes down, times
out, or throws, the main ARIA dashboard, risk engine, and follow-up pipeline keep
working exactly as before — **isolation is the primary design constraint (spec §4)**.

```
Main dashboard (vanilla JS)                     aria-recovery-copilot/ (this module)
└── [Ask ARIA] button ──► new tab ────────►  SAME ORIGIN, /copilot/*
    (signed 5-min token                        │  main app :5000 proxies to the
     in URL query)                             │  Copilot child process on :8000
                                               ▼
                                           FastAPI backend
                                             ├── safety/ triage gate  (Stage 1 regex + Stage 2 GLM)
                                             ├── retrieval (embeddings + Atlas Vector Search w/ fallback)
                                             ├── answer engine (SSE streaming): GLM via Z.ai,
                                             │   or the local extractive RAG composer when no API
                                             │   key is set — full RAG with zero external APIs
                                             ├── serves the built React SPA at /copilot/chat
                                             └── own MongoDB database: aria_copilot
                                                   (kb_chunks, conversations, messages, escalations)
        ── only two narrow calls into the main system ──
        READ   GET  /api/patients/{id}/context-summary   (added to main backend)
        WRITE  POST /api/alerts                          (added to main backend)
        SIGN   POST /api/copilot-token                   (added to main backend)
```

## Layout

| Path | What |
|---|---|
| `backend/app/` | FastAPI service: routes, safety layer, RAG, resilient main-backend client |
| `backend/app/safety/emergency_patterns.yaml` | Stage-1 emergency patterns — reviewable without redeploying logic |
| `backend/seed/` | 62 original knowledge-base chunks (wound, medication, diet/activity, red flags, tiers, FAQ) |
| `backend/scripts/seed_kb.py` | Embeds + inserts the KB; fits the lexical IDF table |
| `backend/scripts/create_vector_index.py` | One-time Atlas Vector Search index creation |
| `backend/scripts/resilience_smoke.py` | Cross-system resilience checks (spec §11.3) |
| `backend/tests/` | 139 tests: red-team (0 false negatives), groundedness, circuit breaker, endpoints, local no-LLM answerer |
| `frontend/` | Copilot SPA: `/chat` only — streaming bubbles, persistent escalation banner, sources |
| `docs/INTEGRATION.md` | Exactly what was added to the main ARIA repo |
| `docs/TESTING.md` | How to run every suite in spec §11 |

## Running it (embedded mode — the default)

The Copilot now runs **inside the main ARIA project**, like every other feature:

```bash
# from the ARIA repo root
npm run dev            # main app on :5000 — spawns the Copilot on :8000 automatically
```

- The main server starts the Copilot backend as a child process
  (`server/src/services/copilotRunner.js`) and proxies it on the **same
  origin** at `/copilot/*` (`server/src/middleware/copilotProxy.js`).
- The **Ask ARIA** button opens `${origin}/copilot/chat?token=…` — one port,
  one deploy, no CORS.
- `/health` reports the Copilot child's status. If the child crashes it is
  restarted (up to 5 attempts); if Python or the venv is missing, the main
  app logs a warning and carries on — the dashboard is never affected.
- Set `COPILOT_ENABLED=false` to run the platform without the Copilot.
- Rebuild the Copilot chat UI after frontend changes: `npm run build:copilot`.

Requires on PATH: Python 3.11+ (or the venv at
`aria-recovery-copilot/backend/.venv`). First run locally:

```bash
cd aria-recovery-copilot/backend
python -m venv .venv
.venv/Scripts/pip install -r requirements-dev.txt   # Windows; use bin/ elsewhere
copy .env.example .env                               # or rely on the main .env
.venv/Scripts/python scripts/seed_kb.py --provider hash
cd ../../.. && npm run build:copilot
```

**STANDALONE mode (optional)**: the module can still be deployed on its own
(`render.yaml` + `backend/Dockerfile` in this folder build a self-hosted
variant at `/`). Point the dashboard button at it by setting
`window.ARIA_COPILOT_URL` in the main app's `index.html`.

## Deployment on Render (spec §12 step 10)

One Render web service runs the WHOLE platform (main app + Copilot together):

1. Push the ARIA repo (which now contains `aria-recovery-copilot/`) to GitHub.
2. In Render: **New + → Blueprint** and connect it. The repo-root `render.yaml`
   creates a single Docker service (`aria-platform`) from the root `Dockerfile`:
   Node main app + Python Copilot in one image, `npm start` boots both, health
   check on `/health`.
3. Fill in the prompted values (`MONGODB_URI`, `ZAI_API_KEY`, Twilio keys).
   `COPILOT_SIGNING_SECRET` is generated once and inherited by both sides —
   no cross-service matching needed anymore.
4. Seed the knowledge base once against the same Atlas cluster (database
   `aria_copilot`): `python aria-recovery-copilot/backend/scripts/seed_kb.py
   --provider zai`, then `create_vector_index.py`.

Free starter plans sleep when idle; the first request after a nap takes a few
seconds. For a patient-facing pilot, keep the service on a paid plan or use an
uptime pinger on `/health`.

## Answer engine — works with or without an LLM API

The answer path has two modes over the SAME retrieval + safety pipeline
(`app/routes/health.py` exposes which one is active as `answer_mode`):

- **`local-extractive` (default, no API key)** — with no `ZAI_API_KEY`
  configured, `app/answerer.py` composes the reply by extracting the most
  question-relevant sentences from the retrieved chunks (IDF-coverage scoring,
  duplicate suppression, category lead-ins, emotional acknowledgment) and
  streams them sentence-by-sentence. Every factual sentence appears verbatim
  in a retrieved chunk, so grounding is strictly enforced. The Copilot is
  fully usable with zero external dependencies and zero cost.
- **`llm` (when an API key exists)** — `ZAI_API_KEY` + `ZAI_BASE_URL` +
  `ZAI_MODEL` drive GLM (or any OpenAI-compatible endpoint) with the verbatim
  §9.4 grounding prompt. The switch is automatic; no code changes.

Stage-2 model triage is enabled only in `llm` mode; Stage-1 pattern triage
always runs, and the escalation flow is identical in both modes.

## Safety model (spec §9)

1. **Stage 1** — conservative pattern match against `emergency_patterns.yaml` (cardiac, breathing,
   bleeding, consciousness, stroke, allergic, self-harm, seizure, sepsis, glucose, clot, overdose, trauma).
2. **Stage 2** — a dedicated GLM classification call (never the answer-generation path) using the
   verbatim §9.2 prompt. If the classifier errors, the message **fails safe to emergency**.
3. On escalation: the fixed §9.3 safety message (never model-generated), an `escalations` record,
   a `POST /api/alerts` write into the main app's existing EventLog pipeline, and a persistent red
   banner in the UI. Signals are logged by category — never raw message text.
4. Non-emergency questions are answered only from retrieved chunks (top-k=5;
   semantic cosine threshold 0.72, lexical dev embedder: BM25 ranking with a
   0.22 threshold — the same BM25Scorer ranks both the in-memory store and the
   Mongo fallback so dev matches tests). With no reliable match the Copilot
   says so and defers to the care team. Sources are attached to every
   grounded answer.
