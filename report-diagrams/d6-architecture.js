/* Fig 4.6 — System Architecture (layered) */
const L = require("./lib");

const W = 1600, H = 1215;

function archBox(x, y, w, h, title, sub) {
  let s = L.rect(x, y, w, h, { fill: L.WHITE, stroke: L.TEAL_DARK, rx: 8, sw: 1.5 });
  const tl = L.wrap(title, Math.floor((w - 20) / 6.9));
  const y0 = sub ? y + h / 2 - 5 - ((tl.length - 1) * 16) / 2 : y + h / 2 + 5;
  s += L.tspans(x + w / 2, y0, tl, { size: 13.5, weight: "bold", anchor: "middle", fill: "#0c3f3a" });
  if (sub) s += L.text(x + w / 2, y + h / 2 + 18 + Math.max(0, (tl.length - 1)) * 8, sub, { size: 11.3, fill: L.SUB, anchor: "middle" });
  return s;
}

function build() {
  const b = [];

  /* ---- Layer 1 : client ---- */
  b.push(L.cluster(56, 130, 1200, 225, "Client Layer", "Browser · single-page app · PWA (public/)"));
  const c1 = [
    ["3D Recovery Stations", "three.js station strip"],
    ["Dashboard & Report UI", "risk · care plan · timeline"],
    ["Medicine Book", "2,035 medicines (JSON)"],
    ["Doctors & Hospital Pages", "directory + specialties"],
    ["Ask ARIA Chat Widget", "SSE streaming client"],
    ["Service Worker", "offline cache · manifest"],
  ];
  c1.forEach(([t, s], i) => {
    const x = 80 + (i % 3) * 395, y = i < 3 ? 198 : 272;
    b.push(archBox(x, y, 370, 62, t, s));
  });

  /* ---- Layer 2 : application ---- */
  b.push(L.cluster(56, 425, 1200, 225, "Application Layer", "Node.js + Express · port 5000 (server/src)"));
  const c2 = [
    ["Static Server + gzip", "pages · media · cache headers"],
    ["Auth API", "scrypt hash · 30-day session"],
    ["Report API", "upload · analyze · dispatch"],
    ["Copilot Gateway", "5-min HS256 copilot JWT"],
    ["OCR Engine", "Tesseract.js · pdfjs · preprocess"],
    ["Risk Engine", "LOW / MEDIUM / HIGH tiers"],
    ["Communication", "Twilio SMS + voice scripts"],
    ["Reverse Proxy /copilot", "SSE passthrough · no buffering"],
  ];
  c2.forEach(([t, s], i) => {
    const x = 80 + (i % 4) * 295, y = i < 4 ? 493 : 567;
    b.push(archBox(x, y, 280, 62, t, s));
  });

  /* ---- Layer 3 : intelligence ---- */
  b.push(L.cluster(56, 720, 1200, 225, "Intelligence Layer", "ARIA Recovery Copilot · FastAPI child process · port 8000"));
  const c3 = [
    ["Safety Triage", "emergency pattern gate — always first"],
    ["RAG Retrieval", "top-k + threshold · category filter"],
    ["KB Store", "kb_chunks · Atlas vector search"],
    ["Extractive Answerer", "grounded · zero external API keys"],
    ["Small-talk + Context", "session summary · topic suggestions"],
    ["Escalation Client", "doctor alerts to main backend"],
  ];
  c3.forEach(([t, s], i) => {
    const x = 80 + (i % 3) * 395, y = i < 3 ? 788 : 860;
    b.push(archBox(x, y, 370, 60, t, s));
  });

  /* ---- Layer 4 : data ---- */
  b.push(L.cluster(56, 1015, 1200, 135, "Data Layer", "MongoDB Atlas (cluster0) + local file archive"));
  const c4 = [
    ["MongoDB Atlas — ARIA-AI_DB", "users · patients · reports · event_logs"],
    ["MongoDB Atlas — aria_copilot", "conversations · kb_chunks (+ vector index)"],
    ["File Archive — uploads/reports", "original uploaded documents"],
  ];
  c4.forEach(([t, s], i) => b.push(archBox(80 + i * 395, 1083, 370, 66, t, s)));

  /* ---- inter-layer arrows ---- */
  const AR = { marker: "mInk", sw: 2.2, stroke: L.TEAL_DARK };
  b.push(L.line(430, 357, 430, 423, AR));
  b.push(L.tag(430, 390, "HTTPS · REST + SSE", { size: 12, weight: "600", fill: L.TEAL_DARK }));
  b.push(L.line(880, 423, 880, 357, { marker: "mInk", sw: 1.4, dash: "6 5", stroke: L.SUB }));
  b.push(L.tag(880, 390, "JSON / SSE replies", { size: 11.5, fill: L.SUB }));

  b.push(L.line(430, 652, 430, 718, AR));
  b.push(L.tag(430, 685, "HTTP 127.0.0.1:8000 · reverse-proxied at /copilot", { size: 12, weight: "600", fill: L.TEAL_DARK }));
  b.push(L.line(880, 718, 880, 652, { marker: "mInk", sw: 1.4, dash: "6 5", stroke: L.SUB }));
  b.push(L.tag(880, 685, "SSE stream back", { size: 11.5, fill: L.SUB }));

  b.push(L.line(350, 947, 350, 1013, AR));
  b.push(L.tag(350, 980, "MongoDB (motor) · TLS", { size: 11.5, fill: L.TEAL_DARK }));
  b.push(L.path(`M 1256 615 L 1272 615 L 1272 1072 L 265 1072 L 265 1081`, { marker: "mInk", sw: 2.2, stroke: L.TEAL_DARK }));
  b.push(`<text x="1258" y="860" font-size="11.8" fill="${L.TEAL_DARK}" font-weight="600" text-anchor="middle" transform="rotate(90 1258 860)">MongoDB (mongoose) · TLS — users · patients · reports</text>`);

  /* ---- external services ---- */
  b.push(L.rect(1288, 545, 268, 310, { fill: "#fbfcfe", stroke: L.PANEL_BORDER, rx: 12, sw: 1.3, dash: "7 5" }));
  b.push(L.text(1422, 571, "External Services", { size: 13.5, weight: "bold", fill: L.SUB, anchor: "middle" }));
  b.push(archBox(1308, 590, 228, 88, "Twilio Cloud", "SMS + programmable voice"));
  b.push(archBox(1308, 710, 228, 88, "Z.ai GLM (optional)", "LLM grounding when keyed"));
  b.push(L.path(`M 1247 598 L 1275 598 L 1275 634 L 1306 634`, { marker: "mInk", sw: 1.8, stroke: L.TEAL_DARK }));
  b.push(L.tag(1276, 583, "HTTPS", { size: 10.5 }));
  b.push(L.path(`M 1256 920 L 1280 920 L 1280 754 L 1306 754`, { marker: "mInk", sw: 1.8, stroke: L.TEAL_DARK }));
  b.push(L.tag(1258, 934, "opt", { size: 10.5 }));

  return L.svgDoc(W, H, "System Architecture", "Four-layer view — client, application, intelligence, and data, plus external services", "4.6", b.join("\n"));
}

module.exports = { build, W, H };
