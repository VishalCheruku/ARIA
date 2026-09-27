/* Fig 4.3 — Admin Activity Diagram */
const L = require("./lib");

const W = 1240, H = 1440;
const CX = 620;

function build() {
  const b = [];
  const AR = { marker: "mInk", sw: 1.5, stroke: L.LINE };

  b.push(L.startDot(CX, 150));

  /* login */
  b.push(L.action(CX - 135, 185, 270, 54, "Open ARIA admin login"));
  b.push(L.line(CX, 159, CX, 183, AR));

  /* credentials decision */
  b.push(L.diamond(CX, 330, 220, 96, "Valid admin credentials?"));
  b.push(L.line(CX, 239, CX, 282, AR));
  /* No loop: error -> back to login */
  b.push(L.action(830, 305, 200, 50, "Show error message"));
  b.push(L.line(730, 330, 828, 330, AR));
  b.push(L.tag(778, 314, "No", { size: 11.5, fill: "#6b3d02", weight: "600" }));
  b.push(L.path(`M 930 303 L 930 217 L 757 217`, AR));
  /* Yes down */
  b.push(L.line(CX, 378, CX, 428, AR));
  b.push(L.tag(650, 405, "Yes", { size: 11.5, fill: "#6b3d02", weight: "600" }));

  /* dashboard */
  b.push(L.action(CX - 135, 430, 270, 54, "Load admin dashboard"));
  b.push(L.forkBar(CX, 545, 440, "«parallel»"));
  b.push(L.line(CX, 484, CX, 541, AR));

  /* left lane — logs */
  b.push(L.action(250, 590, 240, 62, "Review event logs &\nescalation alerts"));
  b.push(L.line(370, 545, 370, 588, AR));
  b.push(L.diamond(370, 750, 200, 92, "Logs need clearing?"));
  b.push(L.line(370, 652, 370, 704, AR));
  b.push(L.action(75, 722, 170, 56, "Clear event log"));
  b.push(L.line(270, 750, 247, 750, AR));
  b.push(L.tag(258, 734, "Yes", { size: 11.5, fill: "#6b3d02", weight: "600" }));
  b.push(L.path(`M 160 778 L 160 845 L 340 845 L 340 851.5`, AR));
  b.push(L.line(370, 796, 370, 851.5, AR));
  b.push(L.tag(382, 826, "No", { size: 11.5, fill: "#6b3d02", weight: "600" }));

  /* right lane — health */
  b.push(L.action(750, 590, 240, 62, "Monitor system &\ncopilot health status"));
  b.push(L.line(870, 545, 870, 588, AR));
  b.push(L.diamond(870, 750, 200, 92, "Copilot healthy?"));
  b.push(L.line(870, 652, 870, 704, AR));
  b.push(L.action(1000, 722, 190, 56, "Restart copilot service"));
  b.push(L.line(970, 750, 998, 750, AR));
  b.push(L.tag(984, 734, "No", { size: 11.5, fill: "#6b3d02", weight: "600" }));
  b.push(L.path(`M 1085 778 L 1085 845 L 900 845 L 900 851.5`, AR));
  b.push(L.line(870, 796, 870, 851.5, AR));
  b.push(L.tag(882, 826, "Yes", { size: 11.5, fill: "#6b3d02", weight: "600" }));

  /* join */
  b.push(L.forkBar(620, 858, 560));
  b.push(L.line(CX, 861.5, CX, 900, AR));

  /* review reports + manage users */
  b.push(L.action(CX - 155, 902, 310, 54, "Review latest AI risk reports"));
  b.push(L.line(CX, 956, CX, 1000, AR));
  b.push(L.action(CX - 155, 1002, 310, 54, "Manage user accounts\n(create · disable · set role)"));

  /* more tasks? loop */
  b.push(L.diamond(CX, 1150, 200, 90, "More admin tasks?"));
  b.push(L.line(CX, 1056, CX, 1105, AR));
  b.push(L.path(`M 520 1150 L 62 1150 L 62 457 L 483 457`, AR));
  b.push(L.tag(400, 1134, "Yes", { size: 11.5, fill: "#6b3d02", weight: "600" }));
  b.push(L.line(CX, 1195, CX, 1240, AR));
  b.push(L.tag(650, 1222, "No", { size: 11.5, fill: "#6b3d02", weight: "600" }));

  /* logout + end */
  b.push(L.action(CX - 100, 1242, 200, 50, "Log out"));
  b.push(L.line(CX, 1292, CX, 1330, AR));
  b.push(L.endNode(CX, 1345));

  return L.svgDoc(W, H, "Admin Activity Diagram", "Workflow of the administrator across account, log and platform-health management", "4.3", b.join("\n"));
}

module.exports = { build, W, H };
