# ARIA AI

ARIA AI (ARogya Intelligent Agent) is an AI-driven post-discharge monitoring and preventive care platform. It extracts patient data from discharge summaries and prescriptions, predicts readmission risk, sends SMS reminders, and triggers call workflows for medium/high-risk patients.

The front end pairs a 3D department console with a scroll-story home, and ships a **Medicine Book** — a searchable phone-book directory of 2,000+ real medicines, each explained in the simplest possible words.

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and add Twilio credentials if you want real SMS/calls.

3. Start MongoDB locally if you want records saved in `ARIA_ai`.

4. Start ARIA:

```bash
npm run dev
```

5. (Optional) Regenerate the Medicine Book dataset — a prebuilt copy ships in `public/data/medicines.json`; the seed sources live in `scripts/medicine-seeds/`:

```bash
node scripts/build_medicine_directory.js
```

6. Open:

```text
http://localhost:5000
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
