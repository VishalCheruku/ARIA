/* Fig 4.2 — Use Case Diagram */
const L = require("./lib");

const W = 1560, H = 1080;

function build() {
  const b = [];

  /* system boundary */
  b.push(L.rect(360, 140, 840, 840, { fill: "#fcfdfe", stroke: "#8aa2b5", sw: 1.6, rx: 6 }));
  b.push(L.text(780, 172, "ARIA Recovery Platform", { size: 15.5, weight: "bold", anchor: "middle", fill: "#23405c", spacing: "0.4" }));

  /* ---------- actors ---------- */
  b.push(L.actor(150, 200, "Guest"));
  b.push(L.actor(150, 540, "Member (Patient)"));
  b.push(L.actor(1410, 260, "Clinician"));
  b.push(L.actor(1410, 570, "Twilio Cloud"));
  b.push(L.actor(1410, 770, "Administrator"));

  /* generalization Member --|> Guest */
  b.push(L.line(150, 530, 150, 292, { marker: "mTri", sw: 1.5, stroke: L.LINE }));

  /* ---------- use cases ---------- */
  const U = (cx, cy, label, o = {}) => { b.push(L.useCase(cx, cy, 262, 66, label, o)); return { cx, cy }; };

  /* column 1 — visitor / member */
  const c1 = 520, c2 = 1040;
  const register = U(c1, 220, "Register Account");
  const login = U(c1, 330, "Log In / Log Out");
  const explore = U(c1, 440, "Explore 3D Recovery Stations");
  const browse = U(c1, 550, "Browse Doctors & Hospitals");
  const search = U(c1, 660, "Search Medicine Book (2,035 medicines)");
  const chat = U(c1, 790, "Chat with ARIA Copilot (Ask ARIA)");
  const clearLogs = U(c1, 920, "Clear Event Logs");

  /* column 2 — clinical flow */
  const viewReport = U(c2, 220, "View Risk Report & Care Plan");
  const upload = U(c2, 330, "Upload Discharge Report");
  const analyze = U(c2, 445, "Analyze Report — OCR + AI Risk");
  const sms = U(c2, 560, "Receive SMS / Voice Follow-up");
  const calendar = U(c2, 680, "View Monitoring Calendar");
  const emergency = U(c2, 800, "Emergency Escalation Alert", { fill: L.RED_FILL, stroke: L.RED, textFill: "#7f1d1d" });
  const manage = U(c2, 920, "Manage User Accounts");

  /* ---------- associations ---------- */
  const A = { stroke: "#41586e", sw: 1.4 };
  /* guest */
  b.push(L.line(162, 224, 388, 218, A));
  b.push(L.line(166, 246, 388, 438, A));
  b.push(L.line(170, 256, 388, 548, A));
  b.push(L.line(176, 262, 388, 656, A));
  b.push(L.line(184, 266, 388, 784, A));
  /* member */
  b.push(L.line(162, 566, 388, 336, A));
  b.push(L.line(166, 590, 388, 796, A));
  /* clinician (right side) */
  b.push(L.line(1398, 292, 1172, 222, A));
  b.push(L.line(1398, 330, 1172, 330, A));
  b.push(L.line(1398, 352, 1172, 674, A));
  /* admin (right side) */
  b.push(L.line(1398, 812, 1172, 916, A));
  b.push(L.path(`M 1398 826 L 1300 852 L 700 860 L 700 920 L 652 920`, A));
  /* Twilio (right side) */
  b.push(L.line(1172, 562, 1396, 606, A));

  /* ---------- include / extend ---------- */
  const INC = { stroke: "#41586e", sw: 1.3, dash: "6 5", marker: "mOpen" };
  b.push(L.line(c2, 364, c2, 411, INC));
  b.push(L.tag(c2 + 62, 388, "«include»", { size: 11, fill: "#4a6a86" }));
  b.push(L.line(c2, 479, c2, 526, INC));
  b.push(L.tag(c2 + 66, 503, "«include»", { size: 11, fill: "#4a6a86" }));
  b.push(L.line(910, 800, 652, 792, INC));
  b.push(L.tag(782, 776, "«extend»", { size: 11, fill: "#7f1d1d", bg: "#fdf3f3" }));

  return L.svgDoc(W, H, "Use Case Diagram", "Actors and their interactions with the ARIA Recovery Platform", "4.2", b.join("\n"));
}

module.exports = { build, W, H };
