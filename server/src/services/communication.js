const twilio = require("twilio");
const EventLog = require("../models/EventLog");

function twilioClient() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;
  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

async function sendSms({ patient, risk }) {
  const body = buildSmsBody(patient, risk);
  const phone = patient.phone;
  const client = twilioClient();
  let status = "demo_sent";
  let providerId = "";

  if (client && process.env.TWILIO_PHONE_NUMBER && phone) {
    try {
      const message = await client.messages.create({
        body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });
      status = message.status || "queued";
      providerId = message.sid;
    } catch (error) {
      status = "failed";
      providerId = error.message || "twilio_error";
    }
  }

  await safeLog({
    type: "sms",
    patientName: patient.name,
    phone,
    riskLevel: risk.level,
    status,
    message: body,
    providerId
  });

  return { status, providerId, message: body };
}

/*
  Voice calls go out for HIGH and MEDIUM-risk reports; LOW receives
  SMS monitoring only. The script is composed per patient from their own
  report — name, diagnosis, medicine list, care plan — nothing canned.
*/
async function startCallWorkflow({ patient, risk }) {
  if (!risk.requiresCall) {
    return { status: "skipped_sms_only", providerId: "", message: "Low risk receives personalized SMS monitoring only." };
  }

  const message = buildCallScript(patient, risk);
  const phone = patient.phone;
  const client = twilioClient();
  let status = "demo_queued";
  let providerId = "";

  if (client && process.env.TWILIO_PHONE_NUMBER && phone) {
    try {
      const call = await client.calls.create({
        twiml: `<Response><Say voice="alice">${escapeXml(message)}</Say></Response>`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });
      status = call.status || "queued";
      providerId = call.sid;
    } catch (error) {
      status = "failed";
      providerId = error.message || "twilio_error";
    }
  }

  await safeLog({
    type: "call",
    patientName: patient.name,
    phone,
    riskLevel: risk.level,
    status,
    message,
    providerId
  });

  return { status, providerId, message };
}

/* ------- personalized message builders (per-report, never canned) ------- */

function diagnosisPhrase(patient) {
  const dx = String(patient.diagnosis || "").trim();
  if (!dx || /^not clearly stated$/i.test(dx)) return "";
  return dx;
}

function buildSmsBody(patient, risk) {
  const name = patient.name || "Patient";
  const parts = [`ARIA reminder for ${name}: your post-discharge risk is ${risk.level}.`];

  const dx = diagnosisPhrase(patient);
  if (dx) parts.push(`Condition noted: ${dx}.`);

  const meds = (patient.medicines || []).slice(0, 3);
  if (meds.length) parts.push(`Key medicines: ${meds.join("; ")}.`);

  const nextStep = risk.carePlan?.[0];
  if (nextStep) parts.push(`Next step: ${nextStep}.`);

  parts.push("Contact your hospital if symptoms worsen.");
  return parts.join(" ");
}

/*
  The voice agent speaks in everyday words — diagnosis and medicines are said
  the way a family member would say them, technical terms kept to a minimum,
  and the call always ends with clear precautions.
*/
function buildCallScript(patient, risk) {
  const name = patient.name || "";
  const greeting = name
    ? `Hello ${name}. This is ARIA, your health helper from the hospital, calling to check on you after you came home.`
    : "Hello. This is ARIA, your health helper from the hospital, calling to check on you after you came home.";

  const riskLine = risk.level
    ? `Your latest report asks for ${risk.level.toLowerCase() === "high" ? "close" : "regular"} care, so please be extra careful in the next few days.`
    : "";

  const dx = diagnosisPhrase(patient);
  const dxLine = dx
    ? `This is about your health problem — ${simplePhrase(dx)}. Take it easy while you recover.`
    : "";

  const meds = (patient.medicines || []).slice(0, 4);
  let medLine = "";
  if (meds.length) {
    medLine = "A few important reminders about your medicines. ";
    medLine += meds
      .map((med, index) => `${index + 1}. ${simplePhrase(med.replace(/[.;]/g, ""))}.`)
      .join(" ");
    medLine += " Please take them every day at the same time, exactly as the hospital told you. Do not stop any medicine or change the dose on your own, even if you feel better. ";
  }

  const precautions =
    "Now, some precautions to stay safe. " +
    "Rest well and do not rush back to heavy work. " +
    "Drink enough water and eat light, fresh food. " +
    "Keep your phone nearby so we can reach you. " +
    "Watch out for these danger signs: fever, trouble breathing, chest pain, strong tiredness, swelling of the feet, or any bleeding. " +
    "If any of these happen, do not wait — call your hospital or go there right away. ";

  const close = "Your family and doctor are also kept informed about your recovery. I will check on you again as planned. Wishing you good health. Goodbye.";

  return [greeting, riskLine, dxLine, medLine, precautions, close]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/* everyday wording for clinical text: drop dosage codes a patient wouldn't say out loud */
function simplePhrase(value) {
  return String(value || "")
    .replace(/\b\d+(\.\d+)?\s?(mg|mcg|ml|iu)\b/gi, "")
    .replace(/\b(daily|od|bd|tid|qid|hs|pc|ac)\b/gi, "every day")
    .replace(/\s*[,;:]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .toLowerCase()
    .replace(/^./, ch => ch.toUpperCase());
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function safeLog(payload) {
  try {
    await EventLog.create(payload);
  } catch (_error) {
    return null;
  }
}

module.exports = { sendSms, startCallWorkflow };
