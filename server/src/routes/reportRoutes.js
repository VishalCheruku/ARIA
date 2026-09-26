const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const express = require("express");
const Patient = require("../models/Patient");
const Report = require("../models/Report");
const EventLog = require("../models/EventLog");
const { extractDocument, extractPatientFields } = require("../services/extractor");
const { assessRisk } = require("../services/riskEngine");
const { sendSms, startCallWorkflow } = require("../services/communication");
const { requireAuth } = require("../middleware/auth");
const { verifyToken } = require("../services/auth");

const router = express.Router();

const UPLOAD_DIR = path.join(process.cwd(), "server", "uploads");
const REPORTS_DIR = path.join(UPLOAD_DIR, "reports");
const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff", ".txt", ".json"]);
const MAX_FILE_BYTES = 15 * 1024 * 1024;

/* Stored names are always random hex — the original name never touches the disk. */
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = safeExtension(file.originalname);
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
    }
  }),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_EXTENSIONS.has(safeExtension(file.originalname))) {
      cb(new Error("Unsupported file type. Upload PDF, scanned PDF, image, TXT, or JSON."));
      return;
    }
    cb(null, true);
  }
});

function safeExtension(name) {
  const ext = path.extname(String(name || "")).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) ? ext : "";
}

function displayName(name) {
  return String(name || "report")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 120) || "report";
}

/* attach the uploader when a session exists — analysis still works anonymously */
async function attachUser(req, _res, next) {
  try {
    const header = req.get("authorization") || "";
    const cookie = req.get("cookie") || "";
    let token = "";
    if (header.toLowerCase().startsWith("bearer ")) token = header.slice(7).trim();
    else {
      const match = cookie.match(/(?:^|;\s*)aria_session=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]);
    }
    const payload = verifyToken(token);
    req.uploader = payload.sub ? String(payload.sub) : null;
  } catch (_error) {
    req.uploader = null;
  }
  next();
}

router.post("/reports/analyze", attachUser, upload.single("document"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Upload a discharge summary, prescription, PDF, image, TXT, or JSON file." });
  }

  const timeline = [];

  try {
    timeline.push(event("Document received", "success"));
    const extracted = await extractDocument(req.file);
    timeline.push(event(`Tesseract pipeline completed: ${extracted.source.extraction.mode}`, "success"));

    const patient = extracted.patient || extractPatientFields(extracted.text);
    timeline.push(event(`Clinical fields extracted for ${patient.name}`, "success"));

    const risk = assessRisk(patient, extracted.text);
    timeline.push(event(`AI risk engine classified patient as ${risk.level}`, risk.level === "HIGH" ? "danger" : "success"));

    /*
      The patient is never put on a timer: SMS + voice dispatch is HELD until the
      AI decision has been shown, then the client releases it within 10 seconds
      via /reports/dispatch/:token. Only family / doctor notices are scheduled.
    */
    const dispatchToken = crypto.randomBytes(10).toString("hex");
    const monitoringDays = MONITORING_DAYS[risk.level] || 7;
    const monitoring = {
      days: monitoringDays,
      startedAt: new Date().toISOString(),
      schedule: buildMonitoringSchedule(risk, monitoringDays)
    };
    pendingDispatches.set(dispatchToken, { patient, risk, reportId: null, dispatched: false });

    const sms = { status: "held_for_decision", providerId: "", message: "Releases within 10s of the AI decision being displayed." };
    const call = risk.requiresCall
      ? { status: "held_for_decision", providerId: "", message: "Releases within 10s of the AI decision being displayed." }
      : { status: "skipped_sms_only", providerId: "", message: "Low risk receives personalized SMS monitoring only." };
    timeline.push(event("AI decision ready — patient follow-up armed until the decision is displayed", "muted"));

    const savedPatient = await safeCreate(Patient, patient);

    /* archive the original document safely: random name, reports-only folder */
    let fileRecord = null;
    try {
      await fs.mkdir(REPORTS_DIR, { recursive: true });
      const storedName = path.basename(req.file.filename);
      await fs.rename(req.file.path, path.join(REPORTS_DIR, storedName));
      fileRecord = {
        originalName: displayName(req.file.originalname),
        storedName,
        size: req.file.size,
        mimetype: req.file.mimetype
      };
      timeline.push(event("Original document archived securely", "success"));
    } catch (_error) {
      fileRecord = null;
    }

    const report = {
      patient,
      extractedText: extracted.text,
      source: extracted.source,
      risk,
      routedContact: patient.phone,
      sms,
      call,
      dispatch: { status: "pending", dispatchedAt: null, token: dispatchToken },
      monitoring,
      timeline,
      uploadedBy: req.uploader || null,
      file: fileRecord
    };
    const savedReport = await safeCreate(Report, report);
    if (savedReport && pendingDispatches.has(dispatchToken)) {
      pendingDispatches.set(dispatchToken, { patient, risk, reportId: savedReport._id, dispatched: false });
    }

    res.json({
      ...report,
      dispatchToken,
      ids: {
        patient: savedPatient?._id || null,
        report: savedReport?._id || null
      },
      database: global.ariaDatabaseStatus || "unknown"
    });
  } catch (error) {
    timeline.push(event(error.message, "danger"));
    res.status(500).json({ error: error.message, timeline });
  } finally {
    /* remove the temp file if it was not archived above */
    fs.unlink(req.file.path).catch(() => {});
  }
});

/*
  Post-decision dispatch: the client calls this within 10s of rendering the AI
  decision. Real SMS/voice for the PATIENT happens exactly once per uploaded
  report; family/doctor notices were already scheduled as showcase entries.
*/
router.post("/reports/dispatch/:token", async (req, res) => {
  try {
    let patient, risk, reportId = null, alreadyDispatched = false;
    const pending = pendingDispatches.get(req.params.token);

    if (pending) {
      ({ patient, risk } = pending);
      reportId = pending.reportId;
      alreadyDispatched = pending.dispatched;
    } else {
      /* in-memory map lost (server restart, reloaded tab): fall back to the saved report */
      const saved = await Report.findById(req.params.token).catch(() => null);
      if (!saved) return res.status(404).json({ error: "Follow-up dispatch not found." });
      patient = saved.patient;
      risk = saved.risk;
      reportId = saved._id;
      alreadyDispatched = saved.dispatch?.status === "dispatched" ||
        (saved.sms && !String(saved.sms.status || "").startsWith("held"));
    }

    if (alreadyDispatched) {
      const existing = reportId ? await Report.findById(reportId).catch(() => null) : null;
      return res.json({
        alreadyDispatched: true,
        sms: existing?.sms || { status: "dispatched" },
        call: existing?.call || { status: "dispatched" },
        monitoring: existing?.monitoring || null,
        timeline: [{ at: new Date().toISOString(), label: "Follow-up already dispatched for this report — one live dispatch per upload", status: "muted" }]
      });
    }

    if (pending) pending.dispatched = true;
    const dispatchedAt = new Date().toISOString();
    const timeline = [
      { at: dispatchedAt, label: "AI decision displayed — patient follow-up released", status: "success" }
    ];

    const sms = await sendSms({ patient, risk });
    timeline.push({
      at: new Date().toISOString(),
      label: `Patient SMS dispatched within 10s of decision — ${sms.status}`,
      status: "success"
    });

    const call = await startCallWorkflow({ patient, risk });
    timeline.push({
      at: new Date().toISOString(),
      label: risk.requiresCall ? `Personalized voice follow-up placed — ${call.status}` : "Voice call not needed — SMS monitoring only",
      status: risk.requiresCall ? "active" : "muted"
    });

    await logScheduledNotices({ patient, risk });

    if (reportId) {
      await Report.findByIdAndUpdate(reportId, {
        $set: {
          sms,
          call,
          "dispatch.status": "dispatched",
          "dispatch.dispatchedAt": dispatchedAt
        }
      }).catch(() => {});
    }

    res.json({ alreadyDispatched: false, sms, call, dispatchedAt, timeline, reportId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/*
  Patient lists are scoped to the signed-in doctor: each clinician only sees
  the reports they uploaded themselves. Anonymous visitors (demo mode) see all.
*/
router.get("/reports", attachUser, async (req, res) => {
  try {
    const query = req.uploader ? { uploadedBy: req.uploader } : {};
    const reports = await Report.find(query)
      .sort({ createdAt: -1 })
      .limit(12)
      .select("patient risk createdAt uploadedBy file.originalName");
    res.json({
      database: global.ariaDatabaseStatus || "unknown",
      scopedToUser: Boolean(req.uploader),
      reports
    });
  } catch (_error) {
    res.json({ database: global.ariaDatabaseStatus || "demo-mode", reports: [] });
  }
});

router.get("/reports/:id", attachUser, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found." });
    if (req.uploader && String(report.uploadedBy) !== String(req.uploader)) {
      return res.status(403).json({ error: "This report belongs to another clinician." });
    }
    res.json({ ...report.toObject(), database: global.ariaDatabaseStatus || "unknown" });
  } catch (_error) {
    res.status(400).json({ error: "Invalid report id." });
  }
});

/* the archived original is only available to signed-in clinical accounts */
router.get("/reports/:id/file", requireAuth, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).select("file");
    if (!report?.file?.storedName) return res.status(404).json({ error: "No archived document for this report." });

    const abs = path.join(REPORTS_DIR, path.basename(report.file.storedName));
    if (!abs.startsWith(REPORTS_DIR)) return res.status(400).json({ error: "Invalid document reference." });
    if (req.user?._id && String(report.uploadedBy) !== String(req.user._id)) {
      return res.status(403).json({ error: "This document belongs to another clinician." });
    }

    await fs.access(abs);
    res.setHeader("Content-Type", report.file.mimetype || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${report.file.originalName || "report"}"`);
    res.sendFile(abs);
  } catch (_error) {
    res.status(404).json({ error: "Archived document is no longer available." });
  }
});

router.get("/demo-patients", (_req, res) => {
  res.json([
    demo("Asha Devi", 72, "Heart failure, diabetes", "+919876543210", "HIGH"),
    demo("Ravi Kumar", 58, "COPD with medication adherence concern", "+919876543211", "MEDIUM"),
    demo("Meena Joseph", 69, "Pneumonia, prior admission", "+919876543212", "HIGH"),
    demo("Vikram Singh", 35, "Minor gastritis, stable at discharge", "+919876543213", "LOW"),
    demo("Surya", 64, "CKD and diabetes with urgent warning signs", "+919876543214", "HIGH"),
    demo("Vikas", 61, "Stroke recovery and high medication burden", "+919876543215", "HIGH")
  ]);
});

router.get("/logs", async (_req, res) => {
  try {
    const logs = await EventLog.find().sort({ createdAt: -1 }).limit(50);
    res.json({ database: global.ariaDatabaseStatus || "unknown", logs });
  } catch (_error) {
    res.json({ database: global.ariaDatabaseStatus || "demo-mode", logs: [] });
  }
});

router.delete("/logs", requireAuth, async (_req, res) => {
  try {
    const result = await EventLog.deleteMany({});
    res.json({ cleared: true, deletedCount: result.deletedCount || 0 });
  } catch (error) {
    res.status(503).json({ cleared: false, error: error.message });
  }
});

function event(label, status) {
  return { at: new Date().toISOString(), label, status };
}

/* ---------- monitoring window (calendar showcase) ---------- */
const pendingDispatches = new Map();
const MONITORING_DAYS = { HIGH: 10, MEDIUM: 7, LOW: 5 };

/*
  Daily automation plan for the calendar. Day 1 is the single LIVE dispatch
  (once per report upload); every later day is showcase-only — nothing is
  actually sent. Family (F) and doctor (D) notices are the scheduled side.
*/
function buildMonitoringSchedule(risk, days) {
  const schedule = [];
  for (let day = 1; day <= days; day++) {
    const entry = {
      day,
      channel: risk.requiresCall ? "call+sms" : "sms",
      time: "09:00"
    };
    if (day === 1) entry.live = true;
    if (risk.level === "HIGH" && (day === 1 || day === Math.min(5, days))) entry.family = true;
    if ((risk.level === "HIGH" && day === 1) || (risk.level === "MEDIUM" && day === Math.min(3, days))) entry.doctor = true;
    schedule.push(entry);
  }
  return schedule;
}

/* scheduling is for family / doctor — logged ahead of time, never sent on the patient's 10s timer */
async function logScheduledNotices({ patient, risk }) {
  const notices = [];
  if (risk.level === "HIGH") {
    notices.push({ type: "family_alert", message: `Family escalation scheduled for ${patient.name} (HIGH risk window)` });
    notices.push({ type: "doctor_alert", message: `Doctor notification scheduled for ${patient.name}` });
  } else if (risk.level === "MEDIUM") {
    notices.push({ type: "doctor_alert", message: `Nurse/doctor review scheduled in 24–48h for ${patient.name}` });
  }
  for (const notice of notices) {
    try {
      await EventLog.create({
        ...notice,
        patientName: patient.name,
        phone: patient.phone,
        riskLevel: risk.level,
        status: "scheduled"
      });
    } catch (_error) {}
  }
}

function demo(name, age, diagnosis, phone, demoRisk) {
  return {
    name,
    age,
    phone,
    diagnosis,
    demoRisk,
    dischargeDate: "2026-08-18",
    medicines: ["Aspirin 75mg daily", "Pantoprazole 40mg daily"],
    text: `Patient: ${name}\nAge: ${age}\nPhone: ${phone}\nDx: ${diagnosis}\nRx: Aspirin 75mg daily, Pantoprazole 40mg daily\nMedical History: Post-discharge follow-up required.\nAdvice: Follow-up after discharge.\nDoctor: Dr. Kavitha Menon`
  };
}

async function safeCreate(Model, payload) {
  try {
    return await Model.create(payload);
  } catch (_error) {
    return null;
  }
}

module.exports = router;
