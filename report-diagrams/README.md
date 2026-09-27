# ARIA Report Diagrams (Figures 4.1 – 4.8)

Ready-to-insert figures for the project report, grounded in the actual codebase
(Express API, FastAPI Recovery Copilot child process, MongoDB Atlas `ARIA-AI_DB`
+ `aria_copilot`, Twilio SMS/voice, Tesseract OCR, PWA frontend).

- `png/` — high-resolution PNGs (2× device scale), insert these into the report
- `svg/` — editable vector sources
- `index.html` — open in a browser to preview all figures

## Regenerate after code changes

```bash
cd report-diagrams
node build.js     # writes svg/*.svg
node render.js    # renders png/*.png via headless Chrome (2x)
```

Layout is hand-authored in `d1…d8.js` + shared helpers in `lib.js` — no
diagram libraries or network needed. PNG sizes are pinned in `render.js`.

## Figure contents (mapped to the real system)

| Fig | Diagram | Grounded in |
|-----|---------|-------------|
| 4.1 | Class Diagram | `models/{User,Patient,Report,EventLog}`, `routes/*`, `services/{auth,ocr,extractor,riskEngine,communication,copilotRunner}`, copilot `routes/chat.py`, `retrieval.py`, `kb_store.py`, `answerer.py`, `db.py`, `safety/triage.py` |
| 4.2 | Use Case Diagram | Guest/Member/Clinician/Admin + Twilio; register/login, stations, doctors/hospitals, Medicine Book, upload→OCR→risk, SMS/voice follow-up, Ask ARIA chat, emergency escalation |
| 4.3 | Admin Activity Diagram | admin login, log review/clear (`DELETE /api/logs`), user management (roles/status), copilot health (`/health`, runner restarts) |
| 4.4 | User Activity Diagram | home → login → browse or upload → OCR → risk tier → SMS/voice dispatch (10 s release) → care plan/calendar → Ask ARIA (triage/RAG) → reminders |
| 4.5 | Sequence Diagram | `/api/copilot-token` (HS256, 5 min) → `POST /copilot/api/chat` SSE → triage → smalltalk/RAG → extractive answer → persist with chunk ids |
| 4.6 | System Architecture | 4 layers + Twilio / optional Z.ai LLM |
| 4.7 | Deployment Diagram | browser device → Render Node host (`aria-exm7`) with Uvicorn child on 127.0.0.1:8000 → Atlas cluster0, Twilio |
| 4.8 | Component Diagram | `public/` UI components, `server/src` API components, copilot module components, two Atlas DBs |

Note: figures 5.1 in the report's list (User Dashboard, Chat Box, etc.) are
runtime screenshots of the app, not diagrams — capture those from the running
app (`npm run dev` → http://localhost:5000).
