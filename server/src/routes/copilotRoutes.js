/*
  ARIA Recovery Copilot — the ONLY integration surface between the main ARIA
  backend and the isolated Copilot module (spec §8.3, §8.4, §8.5).

  Three narrowly-scoped endpoints, each:
    - independently rate-limited (Copilot traffic can never crowd out
      dashboard traffic, spec §4.3),
    - defensively wrapped (any internal error -> logged 503 JSON, never an
      exception propagating into shared router state),
    - authed by a short-lived signed copilot token (HS256 JWT, 5-minute
      expiry, audience "aria-copilot") signed with COPILOT_SIGNING_SECRET —
      the one deliberate coupling point shared only with the Copilot backend.

  Nothing else in the main app changes: no shared code imports, no shared
  process, no new dependencies. If the Copilot dies, these endpoints simply
  stop being called.

  Assumptions (spec §0: state and continue):
    - The main schema stores risk on Report documents (embedded patient
      object, no patient reference), so the risk tier comes from the latest
      report whose embedded patient name matches.
    - "Known restrictions" are derived from the latest report's care plan —
      the closest structured thing ARIA stores to discharge instructions.
    - POST /api/alerts reuses the EXISTING EventLog collection and schema
      (type "doctor_alert"), carrying Copilot-specific fields in `metadata`.
      No parallel alerts collection is created (spec §8.4).
*/

const crypto = require("crypto");
const express = require("express");
const Patient = require("../models/Patient");
const Report = require("../models/Report");
const EventLog = require("../models/EventLog");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const COPILOT_JWT_AUD = "aria-copilot";
const COPILOT_TOKEN_TTL_SECONDS = 5 * 60;

/* ---------------- in-memory fixed-window rate limiter ---------------- */
const rateBuckets = new Map();

function rateLimit({ name, windowMs, max }) {
  return (req, res, next) => {
    const key = `${name}:${req.ip || "unknown"}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= max) {
      return res.status(429).json({ error: "Too many requests. Try again shortly." });
    }
    bucket.count += 1;
    return next();
  };
}

/* ---------------- HS256 JWT (no new dependencies) ---------------- */
function copilotSecret() {
  return process.env.COPILOT_SIGNING_SECRET || "";
}

function b64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signCopilotToken(patientId) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const payload = b64urlJson({
    sub: String(patientId),
    aud: COPILOT_JWT_AUD,
    iat: now,
    exp: now + COPILOT_TOKEN_TTL_SECONDS,
  });
  const signature = crypto
    .createHmac("sha256", copilotSecret())
    .update(`${header}.${payload}`)
    .digest("base64url");
  return {
    token: `${header}.${payload}.${signature}`,
    expiresAt: new Date((now + COPILOT_TOKEN_TTL_SECONDS) * 1000).toISOString(),
  };
}

function verifyCopilotToken(token) {
  const secret = copilotSecret();
  if (!secret) throw new Error("Copilot signing secret is not configured.");
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Copilot token is malformed.");

  const [header, payload, signature] = parts;
  const expected = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    throw new Error("Copilot token signature is invalid.");
  }

  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (decoded.aud !== COPILOT_JWT_AUD) throw new Error("Copilot token audience is invalid.");
  if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Copilot token has expired.");
  }
  return decoded;
}

function readCopilotToken(req) {
  const header = req.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return req.get("x-copilot-token") || "";
}

/* Any token-verification failure is an auth problem (401); anything after
   that is a service problem (503). */
function requireCopilotToken(req) {
  const token = readCopilotToken(req);
  if (!token) {
    const error = new Error("Copilot token is required.");
    error.status = 401;
    throw error;
  }
  try {
    return verifyCopilotToken(token);
  } catch (error) {
    const wrapped = new Error(error.message);
    wrapped.status = 401;
    throw wrapped;
  }
}

function isPlaceholderName(name) {
  return /^(—|-|unknown( patient)?|n\/a)$/i.test(String(name || "").trim());
}

/* ---------------- POST /api/copilot-token (spec §8.5) ---------------- */
router.post("/copilot-token", requireAuth, rateLimit({ name: "copilot-token", windowMs: 60_000, max: 10 }), async (req, res) => {
  try {
    if (!copilotSecret()) {
      return res.status(503).json({ error: "Copilot is not configured on this deployment." });
    }

    /* Resolve which patient the dashboard is showing. Preference: an
       explicit patient_id from the client, else an exact name match (the
       dashboard renders the patient's name), else the most recently created
       patient (the one whose report was just analyzed). */
    let patient = null;
    const { patient_id: patientId, name } = req.body || {};
    if (patientId) {
      patient = await Patient.findById(String(patientId)).maxTimeMS(1500).catch(() => null);
    }
    if (!patient && name && !isPlaceholderName(name)) {
      patient = await Patient.findOne({ name: String(name).trim() })
        .sort({ createdAt: -1 })
        .maxTimeMS(1500)
        .catch(() => null);
    }
    if (!patient) {
      patient = await Patient.findOne().sort({ createdAt: -1 }).maxTimeMS(1500).catch(() => null);
    }
    if (!patient) {
      return res.status(404).json({ error: "No patient record is available for the Copilot." });
    }

    const session = signCopilotToken(patient._id);
    return res.json({ token: session.token, expiresAt: session.expiresAt });
  } catch (error) {
    console.error("[copilot] /copilot-token failed:", error.message);
    return res.status(503).json({ error: "Copilot token could not be issued. Try again shortly." });
  }
});

/* ---------- GET /api/patients/:id/context-summary (spec §8.3) ----------
   Read-only, minimal fields ONLY. Never returns the full discharge
   document, contact numbers, or any other patient record fields. */
const ALLOWED_SUMMARY_FIELDS = ["first_name", "risk_tier", "primary_diagnosis", "medications", "discharge_date", "known_restrictions"];

router.get("/patients/:id/context-summary", rateLimit({ name: "context-summary", windowMs: 60_000, max: 30 }), async (req, res) => {
  try {
    const payload = requireCopilotToken(req);
    if (String(payload.sub) !== String(req.params.id)) {
      return res.status(403).json({ error: "Copilot token does not cover this patient." });
    }

    const patient = await Patient.findById(req.params.id).maxTimeMS(1500);
    if (!patient) return res.status(404).json({ error: "Patient not found." });

    /* Risk tier: latest report whose embedded patient matches by name
       (reports embed the patient object; there is no patient reference). */
    const latestReport = await Report.findOne({ "patient.name": patient.name })
      .sort({ createdAt: -1 })
      .maxTimeMS(1500)
      .catch(() => null);

    const riskLevel = String(latestReport?.risk?.level || "").toUpperCase();
    const rawFirstName = String(patient.name || "").split(/\s+/)[0] || "";
    const summary = {
      first_name: isPlaceholderName(rawFirstName) ? "" : rawFirstName,
      risk_tier: ["LOW", "MEDIUM", "HIGH"].includes(riskLevel) ? riskLevel.charAt(0) + riskLevel.slice(1).toLowerCase() : "",
      primary_diagnosis: patient.diagnosis || "",
      medications: Array.isArray(patient.medicines) ? patient.medicines.filter(Boolean) : [],
      discharge_date: patient.dischargeDate || "",
      /* Care-plan items of the latest report double as known restrictions. */
      known_restrictions: Array.isArray(latestReport?.risk?.carePlan)
        ? latestReport.risk.carePlan.filter((item) => typeof item === "string" && item.trim()).slice(0, 6)
        : []
    };

    return res.json(summary);
  } catch (error) {
    /* Defensive per spec §8.3: log and return a small JSON body — never let
       an exception here affect other routes. Auth failures keep their
       specific message; service failures get the calm generic one. */
    console.error("[copilot] /context-summary failed:", error.message);
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(503).json({ error: "Context summary is temporarily unavailable." });
  }
});

/* ---------------- POST /api/alerts (spec §8.4) ----------------
   Escalation write from the Copilot into the EXISTING EventLog collection
   (the main app's alert log), reusing its existing schema: type
   "doctor_alert" + Copilot fields inside `metadata`. */
router.post("/alerts", rateLimit({ name: "copilot-alerts", windowMs: 60_000, max: 30 }), async (req, res) => {
  try {
    const payload = requireCopilotToken(req);

    const body = req.body || {};
    if (String(body.patient_id || "") !== String(payload.sub)) {
      return res.status(403).json({ error: "Alert does not match the token's patient." });
    }
    if (body.source !== "copilot") {
      return res.status(422).json({ error: "This endpoint only accepts Copilot-sourced alerts." });
    }

    const patient = await Patient.findById(payload.sub).maxTimeMS(1500).catch(() => null);
    const latestReport = patient
      ? await Report.findOne({ "patient.name": patient.name }).sort({ createdAt: -1 }).maxTimeMS(1500).catch(() => null)
      : null;

    const doc = await EventLog.create({
      type: "doctor_alert",
      patientName: patient?.name || "Unknown patient",
      phone: patient?.phone || "",
      riskLevel: latestReport?.risk?.level || "",
      status: "copilot_escalation",
      message: String(body.reason || "Patient described symptoms matching an emergency pattern during a Copilot chat."),
      metadata: {
        source: "copilot",
        severity: ["low", "medium", "high"].includes(String(body.severity)) ? body.severity : "high",
        patient_id: String(payload.sub),
        conversation_id: body.conversation_id || "",
        detected_signal: body.detected_signal || "",
        reported_at: body.timestamp || new Date().toISOString()
      }
    });

    return res.status(201).json({ ok: true, alert_id: String(doc._id) });
  } catch (error) {
    console.error("[copilot] /alerts failed:", error.message);
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(503).json({ error: "Alert could not be recorded. The Copilot retains its own escalation record." });
  }
});

module.exports = router;
