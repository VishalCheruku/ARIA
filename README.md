# ARIA AI

ARIA AI (ARogya Intelligent Agent) is an AI-driven post-discharge monitoring and preventive care platform. It extracts patient data from discharge summaries and prescriptions, predicts readmission risk, sends SMS reminders, and triggers call workflows for medium/high-risk patients.

The front end pairs a 3D department console with a scroll-story home, and ships a **Medicine Book** — a searchable phone-book directory of 2,000+ real medicines, each explained in the simplest possible words.

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example`:

   - `MONGODB_URI` — MongoDB Atlas connection string. Use the **standard (non-SRV)** form (`mongodb://user:pass@host:27017,...`), not `mongodb+srv://` — SRV DNS lookups fail on some Windows setups even when the cluster is fine. In the Atlas dashboard, **Network Access** must allowlist your current IP (or `0.0.0.0/0` if you also deploy to Render) — otherwise the app boots but silently runs in demo mode without persistence.
   - Twilio credentials if you want real SMS/calls; leave blank for demo mode.
   - `ZAI_API_KEY` is **optional** — the Recovery Copilot works without any LLM API (see below).

3. Start ARIA:

```bash
npm run dev
```

   This boots the Express app on :5000 **and** the embedded ARIA Recovery Copilot (FastAPI child process on :8000, proxied at `/copilot`). Python 3.11+ is required — first-run setup (venv, knowledge-base seeding, chat UI build) is documented in [aria-recovery-copilot/README.md](aria-recovery-copilot/README.md).

4. (Optional) Regenerate the Medicine Book dataset — a prebuilt copy ships in `public/data/medicines.json`; the seed sources live in `scripts/medicine-seeds/`:

```bash
node scripts/build_medicine_directory.js
```

5. Open:

```text
http://localhost:5000
```

## Ask ARIA — Recovery Copilot (shipped)

The **✦ Ask ARIA** button opens a patient-facing recovery chat embedded in the same app and same origin (`/copilot/chat`). It answers questions about the patient's own recovery — medicines, diet, activity, wound care, warning signs — with a hard safety layer between the patient and every answer.

- **Full RAG with zero API keys (default)**: retrieval runs over a curated 62-chunk post-discharge knowledge base in the `aria_copilot` MongoDB database; answers are composed by a deterministic extractive composer from the retrieved chunks, so the bot cannot invent medical content and works fully offline. `/copilot/api/health` reports `answer_mode: "local-extractive"`.
- **Optional LLM upgrade**: set `ZAI_API_KEY` (plus `ZAI_BASE_URL`/`ZAI_MODEL`) to any OpenAI-compatible endpoint and the same pipeline switches to model-generated answers with Stage-2 model triage — no code changes needed.
- **Safety first**: emergency messages never reach the answer path — they trigger a fixed safety message, a red banner, and a `doctor_alert` escalation written into the main app's EventLog.
- Every grounded answer ships with its sources; out-of-scope questions defer honestly instead of guessing.

## Tests

```bash
npm test                                              # main app (17 tests)
cd aria-recovery-copilot/backend
.venv/Scripts/python -m pytest tests -q               # Copilot backend (139 tests; bin/ on Linux/macOS)
```

## Demo Policy

- Asha Devi: HIGH
- Ravi Kumar: MEDIUM
- Meena Joseph: HIGH
- Vikram Singh: LOW
- Surya: HIGH
- Vikas: HIGH

Every report creates an SMS event. Only MEDIUM and HIGH reports create a call event.

## Feature Roadmap

The next wave of development, grouped by theme. Checked items are shipped.

### Flagship features

- [x] **Recovery Copilot "Ask ARIA" (shipped)** — an embedded conversational assistant on the same origin: RAG over a curated post-discharge knowledge base with a two-stage emergency-safety layer, sources on every answer, copilot-token auth, and its own isolated `aria_copilot` database. Works with zero LLM API keys (extractive mode); any OpenAI-compatible key upgrades it to model-generated answers.
- [ ] **Conversational AI calls** — upgrade the one-way call workflow into a two-way agent: ARIA asks the patient about medicines and symptoms over the phone, captures spoken answers via Twilio speech recognition, and feeds them back into the risk engine so an adherence slip raises the risk score in real time.
- [ ] **3D digital-twin heart** — a new 3D station where a patient's live risk score drives a beating heart: high risk races and flickers red, recovering patients steady and brighten as adherence check-ins come in. Risk you can see at a glance.
- [ ] **WhatsApp channel** — a second front door on the same Twilio account: patients photograph a prescription, the existing OCR pipeline parses it, and reminders arrive as WhatsApp messages with quick replies (Taken / Skipped / Side effects) that feed straight into the adherence record.

### Closing the loop

- [ ] **Adherence ledger with streaks** — every extracted medicine becomes a daily checklist with streaks and an adherence percentage, giving the risk engine a real behavioral signal instead of a guess.
- [ ] **Autonomous escalation ladder** — unanswered reminders escalate on their own: SMS → WhatsApp → voice call → family alert → doctor alert, with every step logged in the activity timeline.
- [ ] **Red-flag symptom check-in** — daily symptom questions (swelling, fever, pain, breathlessness) run through the existing warning-sign rules and can trigger an urgent call workflow instantly.

### Patient & family

- [ ] **Plain-language discharge explainer** — a simple-words view of every report: what happened, what each medicine does, diet do's and don'ts, warning signs to watch — with read-aloud for elderly or low-literacy patients.
- [ ] **Care Circle dashboard** — family alerts become a live page: one status light per patient (green / amber / red), adherence streaks, upcoming reminders, and a one-tap SOS.
- [ ] **Report comparison** — upload a fresh report and ARIA diffs it against the previous one, highlighting improved or declined values and medicines added or removed.

### Hospital & panel

- [ ] **Live command center** — a ward-level view: all monitored patients color-coded by risk, a live feed of calls and SMS as they fire, and acknowledge / escalate controls. One screen showing the full pipeline working end-to-end.
- [x] **Medicine Book (shipped)** — a phone-book style medicine directory on the hospital page, centred at the bottom: 2,000+ real medicine entries (464 salt molecules with hand-written plain-word explanations, plus real Indian brand products) with instant search by brand, salt or *what it treats*, an A–Z jump rail, and a detail view covering "in simple words / used for / how it is taken / watch out for / call the doctor if". Regenerate the dataset with `node scripts/build_medicine_directory.js` (seed data lives in `scripts/medicine-seeds/`).

## Security Notes

- `.env` and `server/uploads/` (uploaded patient documents) are gitignored and are never pushed.
- `.env.example` contains placeholder values only — copy it to `.env` and add your own Twilio credentials.
- `test/shots/` and `test/videoframes/` are QA artifacts and are not committed.
- Personal project notes (`idea`, `context of ARIA.txt`) are gitignored; `README_UPGRADE.txt` is a technical changelog and is committed.
- Python bytecode, caches, and virtualenvs (`__pycache__/`, `.venv/`, `.pytest_cache/`) and the Copilot chat UI build (`frontend/dist/`, rebuilt with `npm run build:copilot`) are gitignored. If your branch predates these rules, untrack the already-committed copies once: `git rm -r --cached aria-recovery-copilot/backend/.venv "aria-recovery-copilot/backend/**/__pycache__" "aria-recovery-copilot/backend/**/*.pyc" aria-recovery-copilot/frontend/dist` — the files stay on disk, git just stops tracking them.
