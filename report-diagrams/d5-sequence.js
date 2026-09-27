/* Fig 4.5 — Sequence Diagram : Ask ARIA chat, end to end */
const L = require("./lib");

const W = 1660, H = 1250;

const X = { user: 100, widget: 310, node: 560, api: 810, triage: 1000, ret: 1180, ans: 1350, store: 1520 };

function head(cx, w, name, sub) {
  return L.lifelineHead(cx, 140, w, name, sub);
}

function build() {
  const b = [];
  const TOP = 192, BOT = 1170;

  /* lifelines */
  const heads = [
    head(X.user, 120, "Patient / User", "any device"),
    head(X.widget, 160, "Ask ARIA Widget", "browser · ask-aria.js"),
    head(X.node, 180, "Node.js API", "Express · /copilot proxy"),
    head(X.api, 180, "Copilot Chat API", "FastAPI · port 8000"),
    head(X.triage, 150, "Safety Triage", "emergency patterns"),
    head(X.ret, 160, "Retrieval + KB", "vector / BM25 search"),
    head(X.ans, 150, "Local Answerer", "extractive · no API key"),
    head(X.store, 160, "Conversation Store", "MongoDB · aria_copilot"),
  ];
  for (const hd of heads) b.push(hd.svg);
  for (const x of Object.values(X)) b.push(L.line(x, 140 + 52, x, BOT, { stroke: "#9db2c2", sw: 1.2, dash: "5 6" }));

  /* activations */
  b.push(L.activation(X.widget, 225, 920));
  b.push(L.activation(X.node, 225, 82));
  b.push(L.activation(X.node, 375, 52));
  b.push(L.activation(X.node, 612, 50));
  b.push(L.activation(X.api, 415, 690));
  b.push(L.activation(X.triage, 520, 36));
  b.push(L.activation(X.ret, 820, 72));
  b.push(L.activation(X.ans, 945, 40));
  b.push(L.activation(X.store, 455, 36));
  b.push(L.activation(X.store, 748, 22));
  b.push(L.activation(X.store, 1075, 34));

  const INK_M = { marker: "mInk", bg: "#ffffff" };
  const RET = { marker: "mInk", dash: "6 5", bg: "#ffffff", labelFill: "#4a6a86" };
  const RED_M = { marker: "mRed", stroke: L.RED, bg: "#fdf3f3", labelFill: "#7f1d1d" };

  /* --- token issuance --- */
  b.push(L.msg(X.widget, X.node, 225, "1: POST /api/copilot-token (patient ref)", INK_M));
  b.push(L.selfMsg(X.node, 248, "resolve patient · sign HS256 token · 5-min TTL"));
  b.push(L.msg(X.node, X.widget, 295, "2: copilot token + expiresAt", RET));

  /* --- chat round --- */
  b.push(L.msg(X.user, X.widget, 335, "3: type question · press send", INK_M));
  b.push(L.msg(X.widget, X.node, 375, "4: POST /copilot/api/chat  (SSE) + Bearer token", INK_M));
  b.push(L.msg(X.node, X.api, 415, "5: forward stream · verify token + rate limit", INK_M));
  b.push(L.msg(X.api, X.store, 455, "6: persist user message · load history", INK_M));
  b.push(L.msg(X.store, X.api, 488, "conversation + history", RET));
  b.push(L.msg(X.api, X.triage, 520, "7: classify(message)", INK_M));
  b.push(L.msg(X.triage, X.api, 552, "TriageResult — safe", RET));

  /* --- alt frame --- */
  b.push(L.altFrame(275, 580, 1345, 540, "alt"));
  b.push(L.text(295, 618, "[emergency detected]", { size: 12.5, weight: "bold", fill: "#7f1d1d" }));

  b.push(L.msg(X.api, X.node, 638, "8: POST /api/alerts (escalation)", RED_M));
  b.push(L.selfMsg(X.node, 660, "create EventLog · type = doctor_alert"));
  b.push(L.msg(X.api, X.widget, 700, "9: SSE — fixed safety message", RED_M));
  b.push(L.msg(X.widget, X.user, 732, "10: red banner + safety reply", RED_M));
  b.push(L.msg(X.api, X.store, 759, "persist flagged message", { marker: "mRed", stroke: L.RED, bg: "#fdf3f3", labelFill: "#7f1d1d", size: 11 }));

  b.push(L.altDivider(275, 790, 1345, "[else — grounded RAG path]"));

  b.push(L.msg(X.api, X.ret, 825, "11: retrieve(query, top-k, threshold)", INK_M));
  b.push(L.selfMsg(X.ret, 848, "embed query · category filter · vector search"));
  b.push(L.msg(X.ret, X.api, 890, "reliable chunks + scores", RET));

  b.push(L.rect(285, 912, 1320, 118, { fill: "none", stroke: "#8aa2b5", sw: 1.2, rx: 3 }));
  b.push(L.rect(285, 912, 120, 21, { fill: "#e7eef4", stroke: "#8aa2b5", sw: 1.2 }));
  b.push(L.text(345, 927, "loop", { size: 11.5, weight: "bold", anchor: "middle", fill: L.INK }));
  b.push(L.text(415, 927, "[streaming deltas]", { size: 11.5, fill: "#4a6a86" }));

  b.push(L.msg(X.api, X.ans, 950, "12: stream grounded answer (extractive / optional LLM)", INK_M));
  b.push(L.msg(X.ans, X.api, 985, "text delta", RET));
  b.push(L.msg(X.api, X.widget, 1015, "13: SSE delta — reply text", INK_M));

  b.push(L.msg(X.api, X.store, 1080, "14: persist answer + retrieved chunk ids", INK_M));
  b.push(L.msg(X.api, X.widget, 1108, "15: done — answer + cited sources", INK_M));

  b.push(L.msg(X.widget, X.user, 1148, "16: render reply with cited sources", INK_M));

  return L.svgDoc(W, H, "Sequence Diagram", "Ask ARIA chat round-trip — token issuance, safety triage, retrieval, grounded streaming answer", "4.5", b.join("\n"));
}

module.exports = { build, W, H };
