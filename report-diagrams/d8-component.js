/* Fig 4.8 — Component Diagram */
const L = require("./lib");

const W = 1600, H = 1130;

function cyl(cx, topY, w, h, title, sub) {
  const ry = 11, x = cx - w / 2;
  let s = L.rect(x, topY + ry, w, h - 2 * ry, { fill: "#eef6fb", stroke: "#54718a", sw: 1.4 });
  s += `<ellipse cx="${cx}" cy="${topY + h - ry}" rx="${w / 2}" ry="${ry}" fill="#eef6fb" stroke="#54718a" stroke-width="1.4"/>`;
  s += `<ellipse cx="${cx}" cy="${topY + ry}" rx="${w / 2}" ry="${ry}" fill="#dcebf5" stroke="#54718a" stroke-width="1.4"/>`;
  s += L.text(cx, topY + h / 2 - 2, title, { size: 12.8, weight: "bold", anchor: "middle", fill: "#1d3d57" });
  s += L.text(cx, topY + h / 2 + 15, sub, { size: 10.8, anchor: "middle", fill: L.SUB });
  return s;
}

function build() {
  const b = [];

  /* ---------------- containers ---------------- */
  b.push(L.cluster(56, 130, 384, 610, "«subsystem»  ARIA Web Client", "public/ · served by Express"));
  b.push(L.cluster(520, 130, 560, 610, "«subsystem»  ARIA API Server", "Node.js · server/src · port 5000"));
  b.push(L.cluster(1160, 130, 384, 610, "«subsystem»  Recovery Copilot", "FastAPI · isolated child process"));

  /* ---------------- client components ---------------- */
  const CC = [
    ["ui-home-3d", "3D station strip"],
    ["ui-dashboard", "upload · report · calendar"],
    ["ui-medicine-book", "search · 2,035 entries"],
    ["ask-aria-widget", "SSE chat client"],
    ["auth-ui", "login / signup modal"],
    ["service-worker", "offline cache"],
  ];
  CC.forEach(([n, s], i) => b.push(L.componentBox(86, 195 + i * 92, 330, 66, [n, s], { size: 13 })));

  /* ---------------- API components ---------------- */
  const A1 = [
    ["auth-api", "register · login · me · logout"],
    ["report-api", "analyze · dispatch · list"],
    ["copilot-gateway", "token · context · alerts"],
    ["copilot-proxy", "/copilot · SSE stream"],
    ["auth-middleware", "requireAuth · sessions"],
  ];
  A1.forEach(([n, s], i) => b.push(L.componentBox(545, 195 + i * 92, 250, 66, [n, s], { size: 12.5 })));
  const A2 = [
    ["static-server", "pages · gzip · cache"],
    ["ocr-engine", "Tesseract.js pipeline"],
    ["risk-engine", "LOW / MED / HIGH"],
    ["communication-svc", "Twilio SMS + voice"],
    ["mongoose-models", "User · Patient · Report · Log"],
  ];
  A2.forEach(([n, s], i) => b.push(L.componentBox(820, 195 + i * 92, 250, 66, [n, s], { size: 12.5 })));

  /* ---------------- copilot components ---------------- */
  const CP = [
    ["chat-api", "POST /api/chat · SSE"],
    ["session-api", "session + token binding"],
    ["triage-engine", "emergency patterns"],
    ["retrieval-engine", "top-k + threshold"],
    ["kb-store", "kb_chunks vector search"],
    ["answerer", "extractive grounding"],
    ["escalation-client", "doctor alerts"],
    ["conversation-store", "MongoDB history"],
  ];
  CP.forEach(([n, s], i) => b.push(L.componentBox(1186, 195 + i * 68, 330, 56, [n, s], { size: 12.5 })));

  /* ---------------- data + external ---------------- */
  b.push(cyl(680, 900, 260, 90, "MongoDB Atlas — ARIA-AI_DB", "users · patients · reports · logs"));
  b.push(cyl(1300, 900, 260, 90, "MongoDB Atlas — aria_copilot", "conversations · kb_chunks"));
  b.push(L.componentBox(880, 915, 220, 60, ["Twilio Cloud", "SMS + voice"], { size: 12.5 }));

  /* ---------------- dependencies ---------------- */
  const DEP = { stroke: "#4a6a86", sw: 1.3, dash: "6 5", marker: "mOpen" };

  /* client -> API */
  b.push(L.path(`M 416 308 L 543 308`, DEP));                                /* ui-dashboard -> report-api */
  b.push(L.path(`M 416 335 L 496 335 L 496 412 L 543 412`, DEP));           /* ui-dashboard -> copilot-gateway */
  b.push(L.path(`M 416 504 L 543 504`, DEP));                                /* ask-aria -> copilot-proxy */
  b.push(L.path(`M 416 596 L 448 596 L 448 228 L 543 228`, DEP));           /* auth-ui -> auth-api */
  /* copilot-proxy -> chat-api (over the top) */
  b.push(L.path(`M 795 504 L 812 504 L 812 150 L 1120 150 L 1120 223 L 1184 223`, DEP));
  /* report-api -> ocr / risk / communication */
  b.push(L.line(795, 320, 818, 320, DEP));
  b.push(L.path(`M 795 335 L 804 335 L 804 412 L 818 412`, DEP));
  b.push(L.path(`M 795 350 L 816 350 L 816 504 L 818 504`, DEP));
  /* copilot-gateway -> ARIA-AI_DB */
  b.push(L.path(`M 795 430 L 808 430 L 808 890 L 760 890 L 760 898`, DEP));
  b.push(L.tag(808, 660, "reads patients · writes alerts", { size: 10.5 }));
  /* communication -> Twilio */
  b.push(L.path(`M 1070 504 L 1090 504 L 1090 913`, DEP));
  b.push(L.tag(1090, 700, "SMS / voice dispatch", { size: 10.5 }));
  /* mongoose-models -> ARIA-AI_DB */
  b.push(L.path(`M 945 629 L 945 880 L 700 880 L 700 898`, DEP));
  /* copilot internals */
  b.push(L.path(`M 1186 210 L 1172 210 L 1172 359 L 1184 359`, DEP));       /* chat-api -> triage */
  b.push(L.path(`M 1186 232 L 1164 232 L 1164 635 L 1184 635`, DEP));       /* chat-api -> escalation-client */
  b.push(L.path(`M 1516 210 L 1532 210 L 1532 427 L 1518 427`, DEP));       /* chat-api -> retrieval */
  b.push(L.path(`M 1516 232 L 1540 232 L 1540 703 L 1518 703`, DEP));       /* chat-api -> conversation-store */
  b.push(L.line(1351, 455, 1351, 465, DEP));                                 /* retrieval -> kb-store */
  b.push(L.path(`M 1516 495 L 1552 495 L 1552 945 L 1432 945`, DEP));       /* kb-store -> copilot DB */
  b.push(L.path(`M 1351 731 L 1351 898`, DEP));                              /* conversation-store -> copilot DB */
  b.push(L.path(`M 1186 635 L 1082 635`, DEP));                              /* escalation -> API server */
  b.push(L.tag(1134, 620, "POST /api/alerts", { size: 10 }));

  /* ---------------- legend ---------------- */
  const ly = 1058;
  let lx = 80;
  b.push(L.componentBox(lx, ly - 12, 44, 24, "", {}));
  b.push(L.text(lx + 58, ly + 5, "component", { size: 11.5, fill: L.SUB }));
  lx = 260;
  b.push(L.line(lx, ly, lx + 30, ly, { stroke: L.TEAL_DARK, sw: 1.5 }));
  b.push(L.circle(lx + 37, ly, 6, { stroke: L.TEAL_DARK, sw: 1.6 }));
  b.push(L.text(lx + 52, ly + 5, "provided interface", { size: 11.5, fill: L.SUB }));
  lx = 470;
  b.push(L.line(lx, ly, lx + 34, ly, { stroke: "#4a6a86", sw: 1.3, dash: "6 5", marker: "mOpen" }));
  b.push(L.text(lx + 46, ly + 5, "dependency «use»", { size: 11.5, fill: L.SUB }));

  return L.svgDoc(W, H, "Component Diagram", "Software components across the web client, Node.js API server, and the Recovery Copilot", "4.8", b.join("\n"));
}

module.exports = { build, W, H };
