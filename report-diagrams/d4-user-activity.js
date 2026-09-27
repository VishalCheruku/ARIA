/* Fig 4.4 — User Activity Diagram */
const L = require("./lib");

const W = 1240, H = 1980;
const CX = 620;

function build() {
  const b = [];
  const AR = { marker: "mInk", sw: 1.5, stroke: L.LINE };

  b.push(L.startDot(CX, 150));

  /* open home */
  b.push(L.action(CX - 155, 185, 310, 54, "Open ARIA home & explore\nrecovery stations"));
  b.push(L.line(CX, 159, CX, 183, AR));

  /* signed in? */
  b.push(L.diamond(CX, 330, 180, 90, "Signed in?"));
  b.push(L.line(CX, 239, CX, 285, AR));
  b.push(L.action(840, 303, 240, 54, "Register / log in\n(30-day session)"));
  b.push(L.line(710, 330, 838, 330, AR));
  b.push(L.tag(772, 314, "No", { size: 11.5, fill: "#6b3d02", weight: "600" }));
  b.push(L.path(`M 960 357 L 960 428 L 622 428`, AR));
  b.push(L.line(CX, 375, CX, 470, AR));
  b.push(L.tag(650, 400, "Yes", { size: 11.5, fill: "#6b3d02", weight: "600" }));

  /* what do you need? */
  b.push(L.diamond(CX, 520, 210, 92, "What do you need?"));
  b.push(L.line(CX, 430, CX, 474, AR));

  /* left branch — browse */
  b.push(L.path(`M 515 520 L 290 520 L 290 608`, AR));
  b.push(L.tag(405, 504, "Browse information", { size: 11.5 }));
  b.push(L.action(150, 610, 280, 62, "View doctors · hospitals ·\nmedicine book details"));

  /* right branch — analyze */
  b.push(L.path(`M 725 520 L 950 520 L 950 608`, AR));
  b.push(L.tag(838, 504, "Analyze report", { size: 11.5 }));
  b.push(L.action(810, 610, 280, 62, "Upload discharge summary\n(camera / file / PDF)"));
  b.push(L.line(950, 672, 950, 710, AR));
  b.push(L.action(810, 712, 280, 62, "OCR text extraction +\nclinical field parsing"));
  b.push(L.line(950, 774, 950, 812, AR));
  b.push(L.action(810, 814, 280, 62, "AI risk engine scores\nrecovery risk (LOW/MED/HIGH)"));
  b.push(L.line(950, 876, 950, 912, AR));

  /* risk decision */
  b.push(L.diamond(950, 958, 190, 90, "Risk HIGH or MEDIUM?"));
  b.push(L.action(810, 1052, 280, 62, "Dispatch SMS + voice follow-up\n(released within 10 s)"));
  b.push(L.line(950, 1003, 950, 1050, AR));
  b.push(L.tag(990, 1028, "HIGH / MED", { size: 10.5 }));
  b.push(L.path(`M 855 958 L 685 958 L 685 1050`, AR));
  b.push(L.tag(770, 942, "LOW", { size: 11.5 }));
  b.push(L.action(505, 1052, 270, 62, "Schedule SMS-only\nmonitoring plan"));

  /* join the two risk outcomes */
  b.push(L.forkBar(817, 1140, 400));
  b.push(L.line(950, 1114, 950, 1136.5, AR));
  b.push(L.line(640, 1114, 640, 1136.5, AR));
  b.push(L.action(667, 1178, 300, 54, "Show care plan &\nmonitoring calendar"));
  b.push(L.line(817, 1143.5, 817, 1176, AR));

  /* merge with browse branch */
  b.push(L.path(`M 290 672 L 290 1310 L 614 1310`, AR));
  b.push(L.path(`M 817 1232 L 817 1310 L 626 1310`, AR));

  /* Ask ARIA? */
  b.push(L.diamond(CX, 1400, 200, 90, "Opens Ask ARIA chat?"));
  b.push(L.line(CX, 1310, CX, 1355, AR));

  /* chat flow */
  b.push(L.line(CX, 1445, CX, 1488, AR));
  b.push(L.tag(650, 1468, "Yes", { size: 11.5, fill: "#6b3d02", weight: "600" }));
  b.push(L.diamond(CX, 1533, 220, 92, "Emergency signal in message?"));
  b.push(L.action(250, 1620, 280, 62, "Safety message +\ndoctor escalation alert", { fill: L.RED_FILL, stroke: L.RED, textFill: "#7f1d1d" }));
  b.push(L.path(`M 510 1533 L 390 1533 L 390 1618`, AR));
  b.push(L.tag(455, 1517, "Yes", { size: 11.5, fill: "#7f1d1d", weight: "600" }));
  b.push(L.action(710, 1620, 280, 62, "Grounded answer with\nsources (RAG over KB)"));
  b.push(L.path(`M 730 1533 L 850 1533 L 850 1618`, AR));
  b.push(L.tag(782, 1517, "No", { size: 11.5, fill: "#6b3d02", weight: "600" }));
  b.push(L.path(`M 390 1682 L 390 1735 L 618 1735`, AR));
  b.push(L.path(`M 850 1682 L 850 1735 L 622 1735`, AR));

  /* skip path — no chat */
  b.push(L.path(`M 720 1400 L 1060 1400 L 1060 1735 L 626 1735`, AR));
  b.push(L.tag(890, 1384, "No", { size: 11.5, fill: "#6b3d02", weight: "600" }));

  /* reminders + end */
  b.push(L.line(CX, 1735, CX, 1772, AR));
  b.push(L.action(CX - 155, 1774, 310, 54, "Receive daily SMS / voice\nfollow-up reminders"));
  b.push(L.line(CX, 1828, CX, 1866, AR));
  b.push(L.endNode(CX, 1881));

  return L.svgDoc(W, H, "User Activity Diagram", "End-to-end patient / member workflow — explore, analyze a discharge report, and recover with Ask ARIA", "4.4", b.join("\n"));
}

module.exports = { build, W, H };
