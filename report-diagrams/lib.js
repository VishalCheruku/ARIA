/* Shared SVG drawing helpers for the ARIA report diagrams.
   Everything is deterministic, hand-laid-out SVG — no external deps. */

const INK = "#16324a";
const SUB = "#5b6b7d";
const LINE = "#3f4f63";
const TEAL = "#0f766e";
const TEAL_DARK = "#0b5d57";
const TEAL_FILL = "#e3f4f1";
const TEAL_BAND = "#0f766e";
const PANEL = "#f5f9fb";
const PANEL_BORDER = "#c9d8e4";
const AMBER = "#a05a08";
const AMBER_FILL = "#fdf3df";
const RED = "#b42323";
const RED_FILL = "#fdeeee";
const WHITE = "#ffffff";
const SOFT = "#eef5f9";

const FONT = "Segoe UI, Arial, sans-serif";

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(x, y, s, o = {}) {
  const size = o.size || 13;
  const weight = o.weight || "normal";
  const fill = o.fill || INK;
  const anchor = o.anchor || "start";
  const style = o.italic ? ` font-style="italic"` : "";
  const spacing = o.spacing ? ` letter-spacing="${o.spacing}"` : "";
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${style}${spacing}>${esc(s)}</text>`;
}

function tspans(x, y, lines, o = {}) {
  const size = o.size || 13;
  const lh = o.lh || size + 4.5;
  const weight = o.weight || "normal";
  const fill = o.fill || INK;
  const anchor = o.anchor || "start";
  const out = lines.map(
    (ln, i) =>
      `<tspan x="${x}" y="${y + i * lh}" >${esc(ln)}</tspan>`
  );
  return `<text font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${out.join("")}</text>`;
}

function wrap(s, maxChars) {
  const words = String(s).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!cur.length) cur = w;
    else if ((cur + " " + w).length <= maxChars) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

function rect(x, y, w, h, o = {}) {
  const rx = o.rx == null ? 0 : o.rx;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${o.fill || WHITE}" stroke="${o.stroke || "none"}" stroke-width="${o.sw || 1.4}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}${o.opacity != null ? ` opacity="${o.opacity}"` : ""}/>`;
}

function line(x1, y1, x2, y2, o = {}) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.stroke || LINE}" stroke-width="${o.sw || 1.5}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}${o.marker ? ` marker-end="url(#${o.marker})"` : ""}${o.cap ? ` stroke-linecap="${o.cap}"` : ""}/>`;
}

function path(d, o = {}) {
  return `<path d="${d}" fill="${o.fill || "none"}" stroke="${o.stroke || LINE}" stroke-width="${o.sw || 1.5}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}${o.marker ? ` marker-end="url(#${o.marker})"` : ""} stroke-linejoin="round"/>`;
}

/* white-backed label so arrows stay readable underneath */
function tag(cx, cy, s, o = {}) {
  const size = o.size || 12;
  const w = s.length * size * 0.54 + 10;
  const h = size + 7;
  const x = o.x != null ? o.x : cx - w / 2;
  const y = o.y != null ? o.y : cy - h / 2;
  return (
    rect(x, y, w, h, { fill: o.bg || WHITE, rx: 3 }) +
    text(x + w / 2, y + h - 5.5, s, { size, fill: o.fill || LINE, anchor: "middle", weight: o.weight || "normal" })
  );
}

function circle(cx, cy, r, o = {}) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${o.fill || WHITE}" stroke="${o.stroke || LINE}" stroke-width="${o.sw || 1.5}"/>`;
}

/* ---------------- UML building blocks ---------------- */

const CLASS_HDR = 46;      // name band (incl. stereotype line)
const LINE_H = 18.5;       // member line height
const CLASS_PAD = 8;

function classBox(x, y, w, stereotype, name, attrs, methods, o = {}) {
  const hdrH = stereotype ? CLASS_HDR : 34;
  const attrH = attrs.length ? attrs.length * LINE_H + CLASS_PAD * 2 : 14;
  const methH = methods.length ? methods.length * LINE_H + CLASS_PAD * 2 : 0;
  const h = hdrH + attrH + methH;
  const headFill = o.headFill || TEAL_BAND;
  let s = rect(x, y, w, h, { fill: WHITE, stroke: o.stroke || TEAL_DARK, rx: 7, sw: 1.5 });
  s += `<path d="M ${x} ${y + 7} a7 7 0 0 1 7 -7 h ${w - 14} a7 7 0 0 1 7 7 v ${hdrH - 7} h ${-w} z" fill="${headFill}" stroke="${o.stroke || TEAL_DARK}" stroke-width="1.5"/>`;
  if (stereotype) {
    s += text(x + w / 2, y + 16, stereotype, { size: 10.5, fill: "#d8efe9", anchor: "middle", spacing: "0.5" });
    s += text(x + w / 2, y + 34, name, { size: 14.5, weight: "bold", fill: WHITE, anchor: "middle" });
  } else {
    s += text(x + w / 2, y + 23, name, { size: 14.5, weight: "bold", fill: WHITE, anchor: "middle" });
  }
  let yy = y + hdrH + CLASS_PAD + 12;
  for (const a of attrs) { s += text(x + 12, yy, a, { size: 12.4, fill: INK }); yy += LINE_H; }
  if (methods.length) {
    s += line(x, y + hdrH + attrH, x + w, y + hdrH + attrH, { stroke: "#b9cdd9", sw: 1.1 });
    yy = y + hdrH + attrH + CLASS_PAD + 12;
    for (const m of methods) { s += text(x + 12, yy, m, { size: 12.4, fill: "#274a63" }); yy += LINE_H; }
  }
  return { svg: s, h, w };
}

function actor(cx, topY, label, o = {}) {
  const h = 64;
  const c = o.stroke || LINE;
  const s =
    circle(cx, topY + 9, 8.5, { stroke: c, sw: 2 }) +
    line(cx, topY + 17.5, cx, topY + 40, { stroke: c, sw: 2 }) +
    line(cx - 13, topY + 26, cx + 13, topY + 26, { stroke: c, sw: 2 }) +
    line(cx, topY + 40, cx - 11, topY + 58, { stroke: c, sw: 2 }) +
    line(cx, topY + 40, cx + 11, topY + 58, { stroke: c, sw: 2 });
  const lines = wrap(label, 16);
  return s + tspans(cx, topY + h + 14, lines, { size: 13.5, weight: "bold", anchor: "middle", fill: o.labelFill || INK });
}

function useCase(cx, cy, w, h, label, o = {}) {
  let s = `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" fill="${o.fill || TEAL_FILL}" stroke="${o.stroke || TEAL_DARK}" stroke-width="1.5"/>`;
  const maxChars = Math.floor((w - 26) / (o.size ? o.size * 0.55 : 6.9));
  const lines = wrap(label, maxChars);
  const lh = 15.5;
  const y0 = cy - ((lines.length - 1) * lh) / 2 + 4.5;
  s += tspans(cx, y0, lines, { size: o.size || 13, anchor: "middle", fill: o.textFill || "#0c3f3a", weight: o.weight || "600" });
  return s;
}

function diamond(cx, cy, w, h, label, o = {}) {
  const pts = `${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}`;
  let s = `<polygon points="${pts}" fill="${o.fill || AMBER_FILL}" stroke="${o.stroke || AMBER}" stroke-width="1.5"/>`;
  const lines = wrap(label, Math.floor((w - 40) / 6.4));
  const lh = 14.5;
  const y0 = cy - ((lines.length - 1) * lh) / 2 + 4;
  s += tspans(cx, y0, lines, { size: o.size || 12, anchor: "middle", fill: o.textFill || "#6b3d02", weight: "600" });
  return s;
}

function action(x, y, w, h, label, o = {}) {
  let s = rect(x, y, w, h, { fill: o.fill || TEAL_FILL, stroke: o.stroke || TEAL_DARK, rx: 9, sw: 1.5 });
  const lines = Array.isArray(label)
    ? label
    : String(label).split("\n").flatMap((seg) => wrap(seg, Math.floor((w - 26) / 6.5)));
  const lh = 15;
  const y0 = y + h / 2 - ((lines.length - 1) * lh) / 2 + 4.5;
  s += tspans(x + w / 2, y0, lines, { size: o.size || 12.8, anchor: "middle", fill: o.textFill || "#0c3f3a", weight: o.weight || "600" });
  return s;
}

function startDot(cx, cy) {
  return circle(cx, cy, 9, { fill: INK, stroke: INK });
}

function endNode(cx, cy) {
  return circle(cx, cy, 11, { stroke: INK, sw: 2 }) + circle(cx, cy, 5.5, { fill: INK, stroke: "none" });
}

function forkBar(cx, y, w, label) {
  let s = rect(cx - w / 2, y - 3.5, w, 7, { fill: INK, rx: 1 });
  if (label) s += text(cx - w / 2, y - 12, label, { size: 11.5, fill: SUB, italic: true });
  return s;
}

function note(x, y, w, lines, o = {}) {
  const lh = 14.5;
  const h = lines.length * lh + 16;
  let s = `<path d="M ${x} ${y} h ${w - 14} l 14 14 v ${h - 14} h ${-w} z" fill="${o.fill || "#fffbe8"}" stroke="${o.stroke || "#c9b458"}" stroke-width="1.2"/>`;
  s += `<path d="M ${x + w - 14} ${y} v 14 h 14" fill="none" stroke="#c9b458" stroke-width="1.2"/>`;
  s += tspans(x + 9, y + 21, lines, { size: o.size || 11.8, fill: "#5c4a12", italic: !o.noItalic });
  return s;
}

/* ---------------- containers / headers ---------------- */

function cluster(x, y, w, h, title, subtitle, o = {}) {
  let s = rect(x, y, w, h, { fill: o.fill || PANEL, stroke: o.stroke || PANEL_BORDER, rx: 12, sw: 1.3, dash: o.dash });
  s += text(x + 16, y + 26, title, { size: 14.5, weight: "bold", fill: o.titleFill || TEAL_DARK });
  if (subtitle) s += text(x + 16, y + 45, subtitle, { size: 11.5, fill: SUB });
  return s;
}

function header(w, title, subtitle) {
  let s = text(w / 2, 42, title, { size: 25, weight: "bold", anchor: "middle", fill: INK });
  s += text(w / 2, 66, subtitle, { size: 13, anchor: "middle", fill: SUB });
  s += rect(w / 2 - 40, 76, 80, 3, { fill: TEAL, rx: 1.5 });
  return s;
}

function footer(w, h, figNo, title) {
  return (
    line(50, h - 34, w - 50, h - 34, { stroke: "#dde8ef", sw: 1.2 }) +
    text(50, h - 15, `Fig. ${figNo} — ${title}`, { size: 11.5, fill: SUB }) +
    text(w - 50, h - 15, "ARIA · AI-Assisted Post-Discharge Recovery Platform", { size: 11.5, fill: SUB, anchor: "end" })
  );
}

/* lifelines */
function lifelineHead(cx, y, w, name, sub, o = {}) {
  const hh = sub ? 52 : 40;
  let s = rect(cx - w / 2, y, w, hh, { fill: o.fill || TEAL_BAND, stroke: o.stroke || TEAL_DARK, rx: 7, sw: 1.4 });
  if (sub) {
    s += text(cx, y + 20, name, { size: 13.5, weight: "bold", fill: WHITE, anchor: "middle" });
    s += text(cx, y + 38, sub, { size: 10.5, fill: "#cfe8e2", anchor: "middle" });
  } else {
    s += text(cx, y + 25, name, { size: 13.5, weight: "bold", fill: WHITE, anchor: "middle" });
  }
  return { svg: s, hh };
}

function msg(x1, x2, y, label, o = {}) {
  const dash = o.dash ? "6 5" : null;
  let s = line(x1, y, x2, y, { stroke: o.stroke || LINE, sw: 1.5, dash, marker: o.marker || "mInk" });
  s += tag((x1 + x2) / 2, y - 11, label, { size: o.size || 12, bg: o.bg, fill: o.labelFill || "#23405c", weight: o.weight });
  return s;
}

function selfMsg(cx, y, label, o = {}) {
  const reach = o.reach || 26;
  let s = path(`M ${cx} ${y} h ${reach} v 22 h ${-reach}`, { stroke: LINE, sw: 1.5, marker: "mInk" });
  s += tag(cx + reach + 8, y + 11, label, { size: o.size || 12, x: cx + reach + 10, fill: "#23405c" });
  return s;
}

function activation(x, y, h, o = {}) {
  return rect(x - 5, y, 10, h, { fill: o.fill || "#bfe3dc", stroke: TEAL_DARK, sw: 1, rx: 2 });
}

function altFrame(x, y, w, h, label) {
  let s = rect(x, y, w, h, { fill: "none", stroke: "#8aa2b5", sw: 1.3, rx: 3 });
  s += rect(x, y, 118, 22, { fill: "#e7eef4", stroke: "#8aa2b5", sw: 1.3 });
  s += text(x + 59, y + 15, label, { size: 12, weight: "bold", fill: INK, anchor: "middle" });
  return s;
}

function altDivider(x, y, w, label) {
  let s = line(x, y, x + w, y, { stroke: "#8aa2b5", sw: 1.1, dash: "8 6" });
  s += tag(x + w / 2, y, label, { size: 11.5, bg: "#f2f7fa" });
  return s;
}

/* component / artifact / node */
function componentBox(x, y, w, h, name, o = {}) {
  let s = rect(x, y, w, h, { fill: o.fill || WHITE, stroke: o.stroke || TEAL_DARK, rx: 4, sw: 1.4 });
  s += rect(x + 7, y - 7, 10, 14, { fill: o.fill || WHITE, stroke: o.stroke || TEAL_DARK, sw: 1.4, rx: 2 });
  s += rect(x + 21, y - 7, 10, 14, { fill: o.fill || WHITE, stroke: o.stroke || TEAL_DARK, sw: 1.4, rx: 2 });
  const lines = Array.isArray(name) ? name : wrap(name, Math.floor((w - 20) / 6.3));
  const lh = 14.5;
  const y0 = y + h / 2 - ((lines.length - 1) * lh) / 2 + 4.5;
  s += tspans(x + w / 2, y0, lines, { size: o.size || 12.5, anchor: "middle", weight: "600", fill: o.textFill || "#0c3f3a" });
  return s;
}

function lollipop(cx, cy, label, o = {}) {
  const dir = o.dir || 1; // 1 = sticks out to the right
  const s = 26;
  let out = line(cx, cy, cx + dir * s, cy, { stroke: TEAL_DARK, sw: 1.5 });
  out += circle(cx + dir * (s + 7), cy, 7, { stroke: TEAL_DARK, sw: 1.8, fill: WHITE });
  out += text(cx + dir * (s + 16), cy + 4, label, { size: 11, fill: TEAL_DARK, anchor: dir > 0 ? "start" : "end", weight: "600" });
  return out;
}

function artifact(x, y, w, name, o = {}) {
  const lines = Array.isArray(name) ? name : wrap(name, Math.floor((w - 30) / 6.2));
  const lh = 14;
  const h = o.h || lines.length * lh + 18;
  let s = `<path d="M ${x} ${y} h ${w - 16} l 16 16 v ${h - 16} h ${-w} z" fill="${o.fill || "#ffffff"}" stroke="${o.stroke || "#54718a"}" stroke-width="1.3"/>`;
  s += `<path d="M ${x + w - 16} ${y} v 16 h 16" fill="none" stroke="${o.stroke || "#54718a"}" stroke-width="1.3"/>`;
  s += tspans(x + w / 2, y + h / 2 - ((lines.length - 1) * lh) / 2 + 4, lines, { size: o.size || 11.8, anchor: "middle", fill: "#25455f" });
  return s;
}

function nodeBox(x, y, w, h, stereo, name, o = {}) {
  const d = 12; // 3D offset
  let s = rect(x + d, y - d, w, h, { fill: "#d7e4ee", stroke: "#7d97ac", sw: 1.2 });
  s += rect(x, y, w, h, { fill: o.fill || "#f2f8fc", stroke: "#54718a", sw: 1.6, rx: 2 });
  s += text(x + 12, y + 21, stereo, { size: 10.5, fill: "#4a6a86", spacing: "0.5" });
  s += text(x + 12, y + 41, name, { size: 14, weight: "bold", fill: "#1d3d57" });
  return s;
}

/* defs block with all markers */
function defs() {
  return `<defs>
  <marker id="mInk" markerWidth="9" markerHeight="8" viewBox="0 0 10 10" refX="8.6" refY="5" orient="auto-start-reverse"><path d="M0,0.8 L9.4,5 L0,9.2 z" fill="${LINE}"/></marker>
  <marker id="mTeal" markerWidth="9" markerHeight="8" viewBox="0 0 10 10" refX="8.6" refY="5" orient="auto-start-reverse"><path d="M0,0.8 L9.4,5 L0,9.2 z" fill="${TEAL_DARK}"/></marker>
  <marker id="mSub" markerWidth="9" markerHeight="8" viewBox="0 0 10 10" refX="8.6" refY="5" orient="auto-start-reverse"><path d="M0,0.8 L9.4,5 L0,9.2 z" fill="${SUB}"/></marker>
  <marker id="mRed" markerWidth="9" markerHeight="8" viewBox="0 0 10 10" refX="8.6" refY="5" orient="auto-start-reverse"><path d="M0,0.8 L9.4,5 L0,9.2 z" fill="${RED}"/></marker>
  <marker id="mOpen" markerWidth="10" markerHeight="10" viewBox="0 0 10 10" refX="8.6" refY="5" orient="auto-start-reverse"><path d="M1,0.8 L9,5 L1,9.2" fill="none" stroke="${LINE}" stroke-width="1.4"/></marker>
  <marker id="mTri" markerWidth="12" markerHeight="11" viewBox="0 0 12 11" refX="10.4" refY="5.5" orient="auto-start-reverse"><path d="M0.6,0.6 L11,5.5 L0.6,10.4 z" fill="${WHITE}" stroke="${LINE}" stroke-width="1.3"/></marker>
</defs>`;
}

function svgDoc(w, h, title, subtitle, figNo, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">
${defs()}
<rect width="${w}" height="${h}" fill="${WHITE}"/>
${header(w, title, subtitle)}
${body}
${footer(w, h, figNo, title)}
</svg>`;
}

module.exports = {
  INK, SUB, LINE, TEAL, TEAL_DARK, TEAL_FILL, TEAL_BAND, PANEL, PANEL_BORDER,
  AMBER, AMBER_FILL, RED, RED_FILL, WHITE, SOFT, FONT,
  esc, text, tspans, wrap, rect, line, path, tag, circle,
  classBox, actor, useCase, diamond, action, startDot, endNode, forkBar, note,
  cluster, header, footer, lifelineHead, msg, selfMsg, activation, altFrame, altDivider,
  componentBox, lollipop, artifact, nodeBox, svgDoc,
};
