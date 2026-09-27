/* Fig 4.1 — Class Diagram */
const L = require("./lib");

const W = 1690, H = 1150;

function build() {
  const b = [];

  /* ---------- clusters ---------- */
  b.push(L.cluster(36, 118, 408, 952, "Data Models", "MongoDB Atlas · ARIA-AI_DB (Mongoose)"));
  b.push(L.cluster(476, 118, 660, 952, "Node.js API Layer", "Express · server/src · port 5000"));
  b.push(L.cluster(1176, 118, 476, 952, "Recovery Copilot", "FastAPI · isolated child process · port 8000"));

  /* ---------- cluster A : models ---------- */
  const A = [
    ["«entity»", "User",
      ["name : String", "email : String  ⟨unique index⟩", "passwordHash : String  ⟨select:false⟩", "role : String ⟨admin · clinician ·", "care_coordinator · member⟩", "status : String ⟨active · disabled⟩", "lastLoginAt : Date"],
      ["+ sanitizeUser() : Object"]],
    ["«entity»", "Patient",
      ["name : String", "age : Number", "phone : String", "diagnosis : String", "medicalHistory : String[]", "medicines : String[]", "dischargeDate : String"], []],
    ["«entity»", "Report",
      ["patient : Object  ⟨embedded⟩", "extractedText : String", "risk : Object  ⟨level · score · carePlan⟩", "sms : Object", "call : Object", "dispatch : Object ⟨status · token⟩", "monitoring : Object ⟨days · schedule⟩", "timeline : Object[] · uploadedBy : String"], []],
    ["«entity»", "EventLog",
      ["type : String ⟨sms · call · family_alert ·", "doctor_alert · medication_reply⟩", "patientName : String", "phone : String", "riskLevel : String", "status : String", "message · providerId : String", "metadata : Object"], []],
  ];
  const ax = 66, aw = 348;
  const aGaps = [18, 26, 18]; /* wider gap before Report for the composition diamond */
  let ay = 168;
  const aPos = [];
  A.forEach(([st, nm, at, me], i) => {
    const box = L.classBox(ax, ay, aw, st, nm, at, me, { headFill: "#0f766e", stroke: "#0b5d57" });
    b.push(box.svg); aPos.push({ y: ay, h: box.h, mid: ay + box.h / 2 });
    ay += box.h + (aGaps[i] || 18);
  });

  /* Report embeds Patient (composition) */
  const pEnd = aPos[1].y + aPos[1].h, rTop = aPos[2].y;
  b.push(L.line(240, pEnd, 240, rTop, { stroke: "#0b5d57", sw: 1.5 }));
  b.push(`<polygon points="240,${rTop} 234,${rTop - 10} 240,${rTop - 20} 246,${rTop - 10}" fill="#0b5d57"/>`);
  b.push(L.tag(298, (pEnd + rTop) / 2 - 3, "embeds", { size: 11 }));

  /* ---------- cluster B : services ---------- */
  const B1 = [
    ["«routes»", "AuthController", [], ["+ register(req, res)", "+ login(req, res)", "+ me(req, res)", "+ logout(req, res)"]],
    ["«service»", "AuthService", [], ["+ hashPassword(pw) : scrypt", "+ verifyPassword(pw, hash)", "+ signToken(user) : 30-day token", "+ verifyToken(token) : payload", "+ validateEmail / validatePassword"]],
    ["«middleware»", "AuthMiddleware", [], ["+ requireAuth(req, res, next)", "+ currentUser(req) : User"]],
    ["«routes»", "ReportController", [], ["+ analyze(file) : report + timeline", "+ dispatch(token) : sms + call", "+ listReports() · getReport(id)", "+ getArchivedFile(id)"]],
    ["«routes»", "CopilotGateway", [], ["+ issueCopilotToken(patientRef)", "+ contextSummary(id) : minimal", "+ recordAlert(payload)"]],
  ];
  const B2 = [
    ["«service»", "ExtractorService", [], ["+ extractDocument(file)", "+ extractPatientFields(text)"]],
    ["«service»", "OCRService", [], ["+ ocrImage(path)", "+ ocrScannedPdf(pdf, maxPages)", "- preprocessImage(path)"]],
    ["«engine»", "RiskEngine", [], ["+ assessRisk(patient, text)", "   : {level, score, factors,", "      carePlan, requiresCall}"]],
    ["«service»", "CommunicationService", [], ["+ sendSms(patient, risk)", "+ startCallWorkflow(patient, risk)"]],
    ["«runner»", "CopilotRunner", [], ["+ start()", "+ stop()", "+ statusInfo()", "+ probeHealth()"]],
  ];
  const c1x = 504, c2x = 832, cw = 280;
  let y1 = 168;
  const b1Pos = [];
  for (const [st, nm, at, me] of B1) {
    const box = L.classBox(c1x, y1, cw, st, nm, at, me, { headFill: "#2f5d8a", stroke: "#234e75" });
    b.push(box.svg); b1Pos.push({ y: y1, h: box.h, mid: y1 + box.h / 2, end: y1 + box.h }); y1 += box.h + 24;
  }
  let y2 = 168;
  const b2Pos = [];
  for (const [st, nm, at, me] of B2) {
    const box = L.classBox(c2x, y2, cw, st, nm, at, me, { headFill: "#2f5d8a", stroke: "#234e75" });
    b.push(box.svg); b2Pos.push({ y: y2, h: box.h, mid: y2 + box.h / 2, end: y2 + box.h }); y2 += box.h + 24;
  }
  b.push(L.note(c2x, b2Pos[4].end + 18, 240, ["spawns uvicorn child, adopts a healthy", "instance, restarts ≤ 5× — the dashboard", "stays up if the Copilot dies."]));

  /* ---------- cluster C : copilot ---------- */
  const C = [
    ["«SSE routes»", "ChatRouter", ["- session_context : Map", "- session_patient_ids : Map"], ["+ chat(sessionId, msg) : SSE stream", "+ escalationShown(sessionId)"]],
    ["«safety»", "SafetyTriage", [], ["+ classify(message) : TriageResult", "- emergency_patterns.yaml"]],
    ["«retrieval»", "RetrievalEngine", [], ["+ retrieve(query, topK, threshold)", "   : {chunks, best_score, reliable}", "- inferCategories(query) : filter"]],
    ["«vector search»", "KBStore", ["- kb_chunks collection ⟨Atlas⟩"], ["+ search(queryEmbedding) : Chunk[]", "- fallback : in-process cosine"]],
    ["«answerer»", "LocalAnswerer", [], ["+ streamLocalAnswer(request)", "   : extractive text deltas"]],
    ["«store»", "ConversationStore", [], ["+ getConversation(id)", "+ getMessages(id, limit)", "+ addMessage(role, text, chunkIds)"]],
  ];
  const cx0 = 1206, ccw = 416;
  let cy = 168;
  const cPos = [];
  for (const [st, nm, at, me] of C) {
    const box = L.classBox(cx0, cy, ccw, st, nm, at, me, { headFill: "#6d4d8f", stroke: "#59406e" });
    b.push(box.svg); cPos.push({ y: cy, h: box.h, mid: cy + box.h / 2, end: cy + box.h }); cy += box.h + 18;
  }
  b.push(L.note(cx0, cPos[5].end + 16, 416, ["own database: aria_copilot — conversations and", "kb_chunks · escalations POST /api/alerts"]));

  /* ---------- associations ---------- */
  const AR = { stroke: L.LINE, sw: 1.5, marker: "mInk" };
  const DEP = { stroke: L.LINE, sw: 1.4, dash: "6 5", marker: "mOpen" };

  /* AuthController -> AuthService */
  b.push(L.path(`M 644 ${b1Pos[0].end} L 644 ${b1Pos[1].y}`, AR));
  /* AuthService -> User (corridor x=460) */
  b.push(L.path(`M 504 ${b1Pos[1].mid} L 460 ${b1Pos[1].mid} L 460 ${aPos[0].mid} L 414 ${aPos[0].mid}`, AR));
  b.push(L.tag(437, aPos[0].mid - 14, "manages", { size: 11 }));
  /* ReportController -> Extractor (corridor x=794) */
  b.push(L.path(`M 784 ${b1Pos[3].mid - 20} L 794 ${b1Pos[3].mid - 20} L 794 ${b2Pos[0].mid} L 832 ${b2Pos[0].mid}`, AR));
  b.push(L.tag(806, b2Pos[0].mid - 16, "extracts", { size: 11 }));
  /* Extractor -> OCR */
  b.push(L.path(`M 972 ${b2Pos[0].end} L 972 ${b2Pos[1].y}`, AR));
  /* ReportController -> RiskEngine (corridor x=806) */
  b.push(L.path(`M 784 ${b1Pos[3].mid} L 806 ${b1Pos[3].mid} L 806 ${b2Pos[2].mid} L 832 ${b2Pos[2].mid}`, AR));
  b.push(L.tag(798, b2Pos[2].mid - 14, "risk", { size: 11 }));
  /* ReportController -> CommunicationService (corridor x=818) */
  b.push(L.path(`M 784 ${b1Pos[3].mid + 20} L 818 ${b1Pos[3].mid + 20} L 818 ${b2Pos[3].mid} L 832 ${b2Pos[3].mid}`, AR));
  b.push(L.tag(770, b1Pos[3].mid + 34, "notifies", { size: 11 }));
  /* CommunicationService -> EventLog (bottom route x=1120) */
  b.push(L.path(`M 1112 ${b2Pos[3].mid} L 1120 ${b2Pos[3].mid} L 1120 1082 L 240 1082 L 240 ${aPos[3].y + aPos[3].h + 2}`, AR));
  b.push(L.tag(680, 1068, "logs sms / call / alerts", { size: 11 }));
  /* ReportController -> Report (creates) */
  b.push(L.path(`M 504 ${b1Pos[3].mid - 12} L 474 ${b1Pos[3].mid - 12} L 474 ${aPos[2].mid} L 414 ${aPos[2].mid}`, AR));
  b.push(L.tag(459, aPos[2].mid - 14, "creates", { size: 11 }));
  /* CopilotGateway -> EventLog (escalates) */
  b.push(L.path(`M 504 ${b1Pos[4].mid} L 488 ${b1Pos[4].mid} L 488 ${aPos[3].mid} L 414 ${aPos[3].mid}`, AR));
  b.push(L.tag(459, aPos[3].mid - 14, "escalates", { size: 11 }));
  /* CopilotRunner -> ChatRouter (dashed spawn) */
  b.push(L.path(`M 1112 ${b2Pos[4].mid} L 1156 ${b2Pos[4].mid} L 1156 ${cPos[0].mid} L 1176 ${cPos[0].mid}`, DEP));
  b.push(L.tag(1156, 320, "spawns", { size: 11 }));
  /* ChatRouter chain (order labels) */
  const cC = 1414;
  b.push(L.path(`M ${cC} ${cPos[0].end} L ${cC} ${cPos[1].y}`, AR));
  b.push(L.tag(cC + 62, (cPos[0].end + cPos[1].y) / 2, "1 · safety gate", { size: 10.5 }));
  b.push(L.path(`M ${cC} ${cPos[1].end} L ${cC} ${cPos[2].y}`, AR));
  b.push(L.tag(cC + 55, (cPos[1].end + cPos[2].y) / 2, "2 · retrieve", { size: 10.5 }));
  b.push(L.path(`M ${cC} ${cPos[2].end} L ${cC} ${cPos[3].y}`, AR));
  /* ChatRouter -> LocalAnswerer (right corridor) */
  b.push(L.path(`M 1622 ${cPos[0].mid + 30} L 1668 ${cPos[0].mid + 30} L 1668 ${cPos[4].mid} L 1622 ${cPos[4].mid}`, AR));
  b.push(L.tag(1645, 470, "3 · answer", { size: 10.5 }));
  /* ChatRouter -> ConversationStore (left corridor) */
  b.push(L.path(`M 1206 ${cPos[0].mid - 30} L 1190 ${cPos[0].mid - 30} L 1190 ${cPos[5].mid} L 1206 ${cPos[5].mid}`, AR));
  b.push(L.tag(1190, 530, "4 · persist", { size: 10.5 }));

  /* ---------- legend ---------- */
  const ly = 1102;
  let lx = 320;
  b.push(L.line(lx, ly, lx + 34, ly, { stroke: L.LINE, sw: 1.5, marker: "mInk" }));
  b.push(L.text(lx + 44, ly + 4, "association / calls", { size: 11.5, fill: L.SUB }));
  lx += 200;
  b.push(L.line(lx, ly, lx + 34, ly, { stroke: L.LINE, sw: 1.4, dash: "6 5", marker: "mOpen" }));
  b.push(L.text(lx + 44, ly + 4, "dependency / process boundary", { size: 11.5, fill: L.SUB }));
  lx += 300;
  b.push(L.line(lx, ly, lx + 26, ly, { stroke: "#0b5d57", sw: 1.5 }));
  b.push(`<polygon points="${lx + 26},${ly} ${lx + 20},${ly - 8} ${lx + 26},${ly - 16} ${lx + 32},${ly - 8}" fill="#0b5d57"/>`);
  b.push(L.text(lx + 44, ly + 4, "composition (embedded document)", { size: 11.5, fill: L.SUB }));

  return L.svgDoc(W, H, "Class Diagram", "Static structure — data models, Node.js API services, and the isolated Recovery Copilot", "4.1", b.join("\n"));
}

module.exports = { build, W, H };
