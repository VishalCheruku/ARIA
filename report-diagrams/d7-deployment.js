/* Fig 4.7 — Deployment Diagram */
const L = require("./lib");

const W = 1600, H = 940;

function cyl(cx, topY, w, h, title, sub) {
  const ry = 11, x = cx - w / 2;
  let s = L.rect(x, topY + ry, w, h - 2 * ry, { fill: "#eef6fb", stroke: "#54718a", sw: 1.4 });
  s += `<ellipse cx="${cx}" cy="${topY + h - ry}" rx="${w / 2}" ry="${ry}" fill="#eef6fb" stroke="#54718a" stroke-width="1.4"/>`;
  s += `<ellipse cx="${cx}" cy="${topY + ry}" rx="${w / 2}" ry="${ry}" fill="#dcebf5" stroke="#54718a" stroke-width="1.4"/>`;
  s += L.text(cx, topY + h / 2 - 2, title, { size: 12.8, weight: "bold", anchor: "middle", fill: "#1d3d57" });
  s += L.text(cx, topY + h / 2 + 15, sub, { size: 11, anchor: "middle", fill: L.SUB });
  return s;
}

function build() {
  const b = [];

  /* ---------------- client device ---------------- */
  b.push(L.nodeBox(70, 180, 380, 470, "«device»", "Patient / Clinician Device"));
  b.push(L.rect(95, 252, 330, 300, { fill: "#ffffff", stroke: "#54718a", sw: 1.3, rx: 4 }));
  b.push(L.text(110, 274, "«executionEnvironment»", { size: 10.5, fill: "#4a6a86" }));
  b.push(L.text(110, 292, "Web Browser", { size: 13.5, weight: "bold", fill: "#1d3d57" }));
  b.push(L.artifact(110, 306, 300, ["ARIA SPA — index.html · app.js"]));
  b.push(L.artifact(110, 348, 300, ["Ask ARIA widget — ask-aria.js"]));
  b.push(L.artifact(110, 390, 300, ["Medicine Book — medicines.json"]));
  b.push(L.artifact(110, 432, 300, ["Service Worker + manifest (PWA)"]));
  b.push(L.text(260, 590, "mobile browsers supported — responsive layer", { size: 11, fill: L.SUB, anchor: "middle" }));

  /* ---------------- app server ---------------- */
  b.push(L.nodeBox(540, 150, 520, 640, "«executionEnvironment»", "Node.js Server — Render · aria-exm7"));
  b.push(L.artifact(565, 218, 300, ["ARIA API — Express (server/src)"]));
  b.push(L.artifact(885, 218, 150, ["uploads/reports"]));
  b.push(L.text(880, 208, "archive", { size: 10.5, fill: L.SUB, anchor: "end" }));
  b.push(L.line(800, 300, 800, 356, { marker: "mInk", sw: 1.6, stroke: L.LINE }));
  b.push(L.tag(800, 328, "spawns + reverse-proxies /copilot", { size: 10.5 }));
  b.push(L.rect(565, 362, 470, 250, { fill: "#ffffff", stroke: "#54718a", sw: 1.3, rx: 4 }));
  b.push(L.text(580, 384, "«executionEnvironment»", { size: 10.5, fill: "#4a6a86" }));
  b.push(L.text(580, 402, "Python 3.12 · Uvicorn — 127.0.0.1:8000", { size: 13, weight: "bold", fill: "#1d3d57" }));
  b.push(L.artifact(580, 416, 300, ["Recovery Copilot — FastAPI"]));
  b.push(L.artifact(580, 458, 300, ["KB — 62 chunks · triage patterns"]));
  b.push(L.artifact(580, 500, 300, ["own database: aria_copilot"]));
  b.push(L.text(800, 645, "isolated process — main dashboard unaffected if it dies", { size: 11, fill: L.SUB, anchor: "middle" }));
  b.push(L.text(800, 669, "COPILOT_SIGNING_SECRET shared via environment", { size: 11, fill: L.SUB, anchor: "middle" }));
  b.push(L.text(800, 725, "npm run dev / npm start — one command, whole platform", { size: 11, fill: L.SUB, anchor: "middle" }));

  /* ---------------- MongoDB Atlas ---------------- */
  b.push(L.nodeBox(1150, 160, 380, 400, "«databaseSystem»", "MongoDB Atlas — cluster0"));
  b.push(cyl(1340, 236, 330, 84, "ARIA-AI_DB", "users · patients · reports · event_logs"));
  b.push(cyl(1340, 350, 330, 96, "aria_copilot", "conversations · kb_chunks · vector index"));
  b.push(L.text(1340, 500, "Atlas Vector Search index on kb_chunks", { size: 11, fill: L.SUB, anchor: "middle" }));
  b.push(L.text(1340, 524, "non-SRV connection URI on this deployment", { size: 11, fill: L.SUB, anchor: "middle" }));

  /* ---------------- Twilio ---------------- */
  b.push(L.nodeBox(1150, 640, 380, 210, "«cloudService»", "Twilio Cloud"));
  b.push(L.artifact(1175, 716, 330, ["SMS gateway + programmable voice"]));
  b.push(L.text(1340, 800, "personalized monitoring scripts per patient", { size: 11, fill: L.SUB, anchor: "middle" }));

  /* ---------------- communication paths ---------------- */
  const PATH = { stroke: L.LINE, sw: 1.8 };
  b.push(L.line(450, 400, 538, 400, PATH));
  b.push(L.tag(494, 384, "HTTPS 443", { size: 11, weight: "600" }));
  b.push(L.tag(494, 418, "REST + SSE", { size: 10.5 }));

  b.push(L.line(1060, 300, 1148, 300, PATH));
  b.push(L.tag(1104, 282, "MongoDB wire · TLS", { size: 10.5, weight: "600" }));
  b.push(L.tag(1104, 320, "mongoose", { size: 10 }));

  b.push(L.line(1035, 480, 1148, 452, PATH));
  b.push(L.tag(1092, 452, "MongoDB (motor)", { size: 10, weight: "600" }));

  b.push(L.line(1060, 700, 1148, 730, PATH));
  b.push(L.tag(1104, 700, "HTTPS", { size: 10.5, weight: "600" }));
  b.push(L.tag(1104, 738, "SMS / voice dispatch", { size: 10 }));

  return L.svgDoc(W, H, "Deployment Diagram", "Physical nodes — browser device, Node.js host with Copilot child process, Atlas, Twilio", "4.7", b.join("\n"));
}

module.exports = { build, W, H };
