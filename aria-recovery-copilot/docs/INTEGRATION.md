# Integration with the existing ARIA repo

The Copilot is a separate repository and failure domain. This document lists
**every change made to the main ARIA repo** (`C:\VS Code\ARIA`, branch
`chat-bot_feature`) — all of it additive; no existing route, model, or pipeline
was modified.

## 1. New file: `server/src/routes/copilotRoutes.js`

Three narrowly-scoped, individually rate-limited, defensively-wrapped endpoints
(the ONLY contact points with the main system, spec §8.3–§8.5):

| Endpoint | Auth | Rate limit | Purpose |
|---|---|---|---|
| `POST /api/copilot-token` | dashboard session (`requireAuth`) | 10/min/IP | Signs a 5-minute HS256 JWT (`sub=patient_id`, `aud=aria-copilot`) with `COPILOT_SIGNING_SECRET` |
| `GET /api/patients/:id/context-summary` | copilot token (must cover `:id`) | 30/min/IP | Returns ONLY `first_name, risk_tier, primary_diagnosis, medications, discharge_date, known_restrictions` — never the discharge text or contacts |
| `POST /api/alerts` | copilot token (must cover `patient_id`) | 30/min/IP | Escalation write into the **existing** `EventLog` collection (type `doctor_alert`, Copilot fields in `metadata`) |

Notes:
- No new dependencies; the JWT is signed/verified with `node:crypto` HMAC.
- The copilot token can only read/write data for the patient it was minted for.
- Every handler try/catches: auth failures → 401, DB/outage → logged 503 JSON.
- Assumptions (stated in code): risk tier comes from the latest `Report` whose
  embedded patient name matches (reports don't store a patient reference);
  `known_restrictions` derives from that report's care plan.

## 2. Two lines in `server/src/app.js`

```js
const copilotRoutes = require("./routes/copilotRoutes");  // import
app.use("/api", copilotRoutes);                            // mount
```

## 3. Dashboard entry point (spec §6.1) — embedded mode

- `public/index.html` — a floating `#askAriaButton` ("Ask ARIA / Chat about your
  recovery") plus the `window.ARIA_COPILOT_URL` override hook (empty by
  default) and script/style includes.
- `public/ask-aria.js` — self-contained, every path try/catch-wrapped: fetches
  `POST /api/copilot-token` (same-origin cookie auth), opens the Copilot in a
  **new tab** at `${origin}/copilot/chat?token=…`. On any failure: a calm toast
  ("Copilot is temporarily unavailable") and nothing else.
- `public/ask-aria.css` — teal accent, scoped to `#askAriaButton`.

## 3b. Copilot child process + same-origin proxy (embedded mode)

- `server/src/services/copilotRunner.js` — on server boot, spawns the Copilot
  backend (uvicorn, port `COPILOT_PORT` default 8000) as a **child process**,
  polls it healthy (~≤30s), adopts an already-running instance, restarts it on
  crash (max 5 attempts), and shuts it down with the parent. Missing Python or
  `COPILOT_ENABLED=false` → the main app logs and continues without it.
- `server/src/middleware/copilotProxy.js` — streams `/copilot/*` to the child
  (`/copilot/api/chat` → `/api/chat`, `/copilot/chat` → the SPA). Mounted
  BEFORE `express.json` so POST bodies/SSE stream raw. Copilot down → calm
  502 (HTML for browsers, JSON for APIs).
- `server/src/index.js` — starts/stops the runner with the main app.

## 4. Environment variables (main backend)

| Variable | Required | Meaning |
|---|---|---|
| `COPILOT_SIGNING_SECRET` | for Copilot flow | 32+ byte random string. Signs (main app) and verifies (Copilot child inherits this exact env value) — the one deliberate coupling point (spec §8.5) |
| `COPILOT_ENABLED` | no | `false` disables the Copilot child entirely |
| `COPILOT_PORT` | no | Copilot child port (default 8000, internal only) |
| `COPILOT_PYTHON` | no | Python interpreter override (set in the Docker image) |
| `ARIA_COPILOT_URL` (frontend, via index.html) | only for standalone mode | Leave empty for embedded mode |

## 5. Deploying the whole platform on Render (single service)

One Render web service runs everything. The repo-root `Dockerfile` builds a
combined image: Node main app + Python Copilot runtime + the prebuilt Copilot
SPA; `npm start` boots the main server, which spawns the Copilot child and
proxies it at `/copilot`. The repo-root `render.yaml` is the Blueprint:

- runtime `docker`, health check `/health` (reports the Copilot child's state)
- `COPILOT_SIGNING_SECRET` is generated once — both sides read the same env
- `MAIN_BACKEND_URL=http://127.0.0.1:10000` — the Copilot's two boundary calls
  (context-summary read, alerts write) hit this same service
- fill in `MONGODB_URI`, `ZAI_API_KEY`, and the Twilio keys

**Data**: one Atlas cluster is fine — the Copilot runs strictly on its own
database name `aria_copilot`. After the first deploy, run
`aria-recovery-copilot/backend/scripts/seed_kb.py --provider zai` and
`create_vector_index.py` once against that cluster.

(A fully standalone Copilot deployment remains available via
`aria-recovery-copilot/render.yaml` if ever needed; then set
`window.ARIA_COPILOT_URL` in the main app's `index.html` and point
`MAIN_BACKEND_URL`/`COPILOT_SIGNING_SECRET` at each other.)

## 6. Isolation guarantees checklist (spec §4, adapted to embedded mode)

- [x] One repo, one deploy, one port — but still a **separate process**: if the Copilot child crashes or hangs, the runner restarts it and the dashboard is never affected (calm 502 at `/copilot` meanwhile)
- [x] Separate database name (`aria_copilot`) — never the main app's collections
- [x] Dependency direction is Copilot → Main only; the main app never calls the Copilot
- [x] The button can't throw into the dashboard; token failures disable only the button
- [x] Copilot calls are bounded: 2s connect / 4s total, circuit breaker (3 fails → open, 30s → half-open), cached last-known-good context
- [x] The three main-backend endpoints have their own rate limits and `maxTimeMS` query budgets
- [x] No shared queues, caches, or workers — the child inherits env vars, nothing else
