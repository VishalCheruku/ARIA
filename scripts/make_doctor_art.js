/**
 * ARIA · Chapter The Doctor — cover + hero artwork generator.
 * Bakes the six magazine covers and six chapter heroes used by public/doctors.html.
 * Run: node scripts/make_doctor_art.js
 */
const fs = require("fs");
const path = require("path");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");

const OUT = path.join(__dirname, "..", "public", "media", "doctors");
fs.mkdirSync(OUT, { recursive: true });

/* ---------- system fonts (offline-safe) ---------- */
const FONT_FILES = [
  ["georgia.ttf", "Georgia"], ["georgiab.ttf", "Georgia"],
  ["georgiai.ttf", "Georgia"], ["georgiaz.ttf", "Georgia"],
  ["times.ttf", "TimesNewRoman"], ["timesbi.ttf", "TimesNewRoman"],
  ["timesbd.ttf", "TimesNewRoman"], ["arial.ttf", "Arial"], ["arialbd.ttf", "Arial"],
  ["ariblk.ttf", "Arial"], ["segoesc.ttf", "SegoeScript"], ["segoescb.ttf", "SegoeScript"],
  ["pala.ttf", "Palatino"], ["palab.ttf", "Palatino"], ["palabds.ttf", "Palatino"],
];
for (const [file, family] of FONT_FILES) {
  const p = path.join("C:", "Windows", "Fonts", file);
  if (fs.existsSync(p)) GlobalFonts.registerFromPath(p, family);
}

function fontOf(style, size) {
  const fam = { georgia: "Georgia", times: "TimesNewRoman", arial: "Arial", script: "SegoeScript", pal: "Palatino" }[style] || "Georgia";
  return `${size}px "${fam}"`;
}

/* ---------- helpers ---------- */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function washes(ctx, w, h, palette, seed) {
  const rand = rng(seed);
  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, w, h);
  const cols = palette.wash;
  for (let i = 0; i < 16; i++) {
    const x = rand() * w, y = rand() * h, r = (0.18 + rand() * 0.42) * Math.max(w, h);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = cols[i % cols.length];
    g.addColorStop(0, c.replace("A", String(0.10 + rand() * 0.14).slice(0, 4)));
    g.addColorStop(1, c.replace("A", "0"));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // faint vertical silk streaks
  for (let i = 0; i < 26; i++) {
    const x = rand() * w, wd = 8 + rand() * 60;
    const g = ctx.createLinearGradient(x, 0, x + wd, h);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, `rgba(255,255,255,${0.02 + rand() * 0.035})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - wd, 0, wd * 2, h);
  }
}

function grain(ctx, w, h, seed, amount = 14) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let s = seed >>> 0;
  for (let i = 0; i < d.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const n = ((s >>> 16) & 255) - 128;
    const a = amount / 255;
    d[i] += n * a; d[i + 1] += n * a; d[i + 2] += n * a;
  }
  ctx.putImageData(img, 0, 0);
}

function vignette(ctx, w, h, strength = 0.10) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.36, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, "rgba(30,28,24,0)");
  g.addColorStop(1, `rgba(30,28,24,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function spaced(ctx, text, cx, y, ls) {
  const chars = [...text];
  const widths = chars.map(c => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + ls * (chars.length - 1);
  let x = cx - total / 2;
  chars.forEach((c, i) => { ctx.fillText(c, x, y); x += widths[i] + ls; });
  return total;
}

/* ---------- motifs ---------- */
function glowStroke(ctx, color, width, fn) {
  ctx.save();
  ctx.strokeStyle = color; ctx.globalAlpha = 0.08; ctx.lineWidth = width;
  fn(); ctx.stroke();
  ctx.globalAlpha = 1; ctx.lineWidth = width / 9;
  fn(); ctx.stroke();
  ctx.restore();
}

function ecg(ctx, x, y, w, color, amp = 1) {
  const p = [
    [0, 0], [0.16, 0], [0.20, -0.10], [0.24, 0], [0.30, 0], [0.33, -0.52], [0.365, 0.58], [0.40, 0], [0.52, 0],
    [0.55, -0.16], [0.58, 0.10], [0.62, 0], [0.78, 0], [0.815, -0.50], [0.85, 0.56], [0.885, 0], [1, 0],
  ];
  glowStroke(ctx, color, 26, () => {
    ctx.beginPath();
    const span = w * 760;
    p.forEach(([px, py], i) => ctx[i ? "lineTo" : "moveTo"](x + (px - 0.5) * span, y + py * span * 0.15 * amp));
  });
}

function stethoscope(ctx, cx, cy, s, color) {
  glowStroke(ctx, color, 30, () => {
    ctx.beginPath();
    ctx.arc(cx, cy, 150 * s, Math.PI * 0.92, Math.PI * 2.08);   // headband
    ctx.moveTo(cx - 146 * s, cy + 34 * s);
    ctx.bezierCurveTo(cx - 220 * s, cy + 340 * s, cx + 190 * s, cy + 400 * s, cx + 150 * s, cy + 560 * s); // tube
    ctx.moveTo(cx + 146 * s, cy + 34 * s);
    ctx.bezierCurveTo(cx + 210 * s, cy + 320 * s, cx + 60 * s, cy + 430 * s, cx + 150 * s, cy + 560 * s);
  });
  // ear tips + chest piece
  ctx.fillStyle = color; ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.arc(cx - 150 * s, cy + 30 * s, 13 * s, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 150 * s, cy + 30 * s, 13 * s, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 10 * s; ctx.strokeStyle = color;
  ctx.beginPath(); ctx.arc(cx + 150 * s, cy + 590 * s, 46 * s, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + 150 * s, cy + 590 * s, 12 * s, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 150 * s, cy + 560 * s); ctx.lineTo(cx + 150 * s, cy + 544 * s); ctx.stroke();
}

function molecule(ctx, cx, cy, s, color) {
  const nodes = [[0, -170], [150, -80], [120, 110], [-10, 190], [-150, 90], [-130, -95], [0, -30], [85, 30], [-60, 25]];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 0], [6, 2], [6, 4], [6, 7], [6, 8], [1, 7], [3, 8], [2, 7], [4, 8]];
  glowStroke(ctx, color, 20, () => {
    ctx.beginPath();
    edges.forEach(([a, b]) => {
      ctx.moveTo(cx + nodes[a][0] * s, cy + nodes[a][1] * s);
      ctx.lineTo(cx + nodes[b][0] * s, cy + nodes[b][1] * s);
    });
  });
  nodes.forEach(([nx, ny], i) => {
    const r = (i < 6 ? 15 : 9) * s;
    ctx.beginPath(); ctx.arc(cx + nx * s, cy + ny * s, r, 0, 7);
    ctx.fillStyle = color; ctx.globalAlpha = i < 6 ? 0.9 : 0.55; ctx.fill();
    if (i < 6) { ctx.globalAlpha = 1; ctx.lineWidth = 2.4 * s; ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(cx + nx * s, cy + ny * s, r + 8 * s, 0, 7); ctx.stroke(); }
  });
  ctx.globalAlpha = 1;
}

function education(ctx, cx, cy, s, color) {
  // book stack
  for (let i = 0; i < 4; i++) {
    const bw = (250 - i * 26) * s, bh = 34 * s, by = cy + 150 * s - i * 40 * s, bx = cx - bw / 2 + (i % 2 ? 10 : -10) * s;
    ctx.save();
    ctx.translate(bx + bw / 2, by); ctx.rotate((i % 2 ? 1 : -1) * 0.012 * (i + 1));
    ctx.fillStyle = color; ctx.globalAlpha = 0.14;
    ctx.fillRect(-bw / 2, 0, bw, bh);
    ctx.globalAlpha = 0.85; ctx.lineWidth = 2.6 * s; ctx.strokeStyle = color;
    ctx.strokeRect(-bw / 2, 0, bw, bh);
    ctx.beginPath(); ctx.moveTo(-bw / 2 + 18 * s, 0); ctx.lineTo(-bw / 2 + 18 * s, bh); ctx.stroke();
    ctx.restore();
  }
  // laurel arch
  ctx.globalAlpha = 0.85; ctx.strokeStyle = color; ctx.lineWidth = 2.6 * s;
  ctx.beginPath(); ctx.arc(cx, cy - 20 * s, 190 * s, Math.PI * 1.18, Math.PI * 1.82); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy - 20 * s, 158 * s, Math.PI * 1.22, Math.PI * 1.78); ctx.stroke();
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 1.5 + side * (0.14 + i * 0.085);
      const lx = cx + Math.cos(a) * 174 * s, ly = cy - 20 * s + Math.sin(a) * 174 * s;
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(a + Math.PI / 2);
      ctx.globalAlpha = 0.8; ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(0, 0, 15 * s, 5 * s, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

function heartArt(ctx, cx, cy, s, color) {
  glowStroke(ctx, color, 26, () => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + 220 * s);                                        // apex
    ctx.bezierCurveTo(cx - 260 * s, cy + 60 * s, cx - 190 * s, cy - 200 * s, cx - 40 * s, cy - 150 * s); // left lobe
    ctx.bezierCurveTo(cx - 10 * s, cy - 136 * s, cx + 10 * s, cy - 130 * s, cx + 40 * s, cy - 148 * s);  // cleft
    ctx.bezierCurveTo(cx + 195 * s, cy - 195 * s, cx + 260 * s, cy + 60 * s, cx, cy + 220 * s);          // right lobe
  });
  // great vessels
  glowStroke(ctx, color, 20, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 30 * s, cy - 150 * s);
    ctx.bezierCurveTo(cx - 45 * s, cy - 250 * s, cx + 20 * s, cy - 260 * s, cx + 30 * s, cy - 210 * s);
    ctx.moveTo(cx + 55 * s, cy - 160 * s);
    ctx.bezierCurveTo(cx + 80 * s, cy - 240 * s, cx + 150 * s, cy - 235 * s, cx + 150 * s, cy - 165 * s);
    ctx.moveTo(cx + 85 * s, cy - 190 * s);
    ctx.bezierCurveTo(cx + 95 * s, cy - 150 * s, cx + 120 * s, cy - 140 * s, cx + 135 * s, cy - 120 * s);
  });
  // coronary arteries
  glowStroke(ctx, color, 12, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 40 * s, cy - 130 * s);
    ctx.bezierCurveTo(cx - 60 * s, cy - 40 * s, cx - 30 * s, cy + 60 * s, cx - 70 * s, cy + 130 * s);
    ctx.moveTo(cx + 50 * s, cy - 140 * s);
    ctx.bezierCurveTo(cx + 90 * s, cy - 40 * s, cx + 60 * s, cy + 80 * s, cx + 20 * s, cy + 170 * s);
  });
  // hatch shading
  ctx.globalAlpha = 0.12; ctx.lineWidth = 1.1 * s; ctx.strokeStyle = color;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 150 * s + i * 16 * s, cy - 120 * s + i * 22 * s);
    ctx.quadraticCurveTo(cx + 40 * s, cy + 30 * s, cx - 40 * s + i * 14 * s, cy + 210 * s - i * 8 * s);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function burst(ctx, cx, cy, s, color) {
  ctx.save(); ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5; ctx.lineWidth = 2.2 * s;
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * Math.PI * 2, long = i % 4 === 0;
    const r1 = 205 * s, r2 = (long ? 320 : 272) * s;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.9; ctx.lineWidth = 3 * s;
  ctx.beginPath(); ctx.arc(cx, cy, 205 * s, 0, 7); ctx.stroke();
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath(); ctx.arc(cx, cy, 180 * s, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 336 * s, 0, 7); ctx.stroke();
  // medal star
  ctx.globalAlpha = 0.92; ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 34 * s : 88 * s;
    ctx[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

const MOTIFS = { ecg, stethoscope, molecule, education, heartArt, burst };

/* ---------- card cover ---------- */
function drawCover(ctx, W, H, card) {
  const P = card.palette;
  washes(ctx, W, H, P, card.seed);
  const ink = P.ink;

  // frame rules top/bottom
  ctx.strokeStyle = ink; ctx.globalAlpha = 0.55; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(46, 40); ctx.lineTo(W - 46, 40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(46, H - 40); ctx.lineTo(W - 46, H - 40); ctx.stroke();
  ctx.globalAlpha = 1;

  // masthead
  ctx.fillStyle = ink; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.font = '600 25px "Palatino", "Georgia", serif';
  spaced(ctx, "ARIA MEDICAL", W / 2, 92, 9);
  ctx.font = '20px "Palatino", Georgia, serif'; ctx.globalAlpha = 0.75;
  spaced(ctx, "CHAPTER · THE DOCTOR", W / 2, 126, 5);
  ctx.globalAlpha = 1;

  // issue no corners
  ctx.font = '22px "Palatino", Georgia, serif'; ctx.globalAlpha = 0.8;
  ctx.textAlign = "left"; ctx.fillText(card.no, 50, 96);
  ctx.textAlign = "right"; ctx.fillText(card.year, W - 50, 96);
  ctx.globalAlpha = 1;

  // big title block
  ctx.textAlign = "left";
  const ty = card.titleY;
  card.title.forEach((line, i) => {
    ctx.font = fontOf(line.style, line.size * (card.titleScale || 1));
    ctx.fillStyle = line.color || ink;
    const ly = ty + i * line.gap;
    if (line.caps) spaced(ctx, line.text.toUpperCase(), W / 2, ly, line.ls ?? size * 0.06);
    else ctx.fillText(line.text, W / 2 - ctx.measureText(line.text).width / 2, ly);
  });

  // photo window with white frame
  const ph = card.photo, f = 16;
  ctx.fillStyle = "#fbfaf6";
  ctx.fillRect(ph.x - f, ph.y - f, ph.w + 2 * f, ph.h + 2 * f);
  ctx.save();
  ctx.beginPath(); ctx.rect(ph.x, ph.y, ph.w, ph.h); ctx.clip();
  // inner duotone scene
  const g = ctx.createLinearGradient(ph.x, ph.y, ph.x + ph.w, ph.y + ph.h);
  g.addColorStop(0, P.deep); g.addColorStop(1, P.deep2);
  ctx.fillStyle = g; ctx.fillRect(ph.x, ph.y, ph.w, ph.h);
  const wash = [
    [0.2, 0.25], [0.75, 0.3], [0.5, 0.72], [0.85, 0.8], [0.15, 0.85],
  ];
  const pw = P.photoWash || P.wash;
  const rand = rng(card.seed * 7 + 3);
  wash.forEach(([px, py], i) => {
    const rg = ctx.createRadialGradient(ph.x + px * ph.w, ph.y + py * ph.h, 0, ph.x + px * ph.w, ph.y + py * ph.h, ph.w * 0.55);
    rg.addColorStop(0, pw[i % pw.length].replace("A", "0.30"));
    rg.addColorStop(1, pw[i % pw.length].replace("A", "0"));
    ctx.fillStyle = rg; ctx.fillRect(ph.x, ph.y, ph.w, ph.h);
  });
  // motif
  ctx.save();
  ctx.translate(ph.x, ph.y);
  MOTIFS[card.motif](ctx, ph.w / 2, ph.h * (card.motifY || 0.5), ph.w / (card.motifW || 620), P.motif);
  ctx.restore();
  grain(ctx, ph.w, ph.h, card.seed + 11, 12);
  ctx.restore();
  // inner hairline
  ctx.strokeStyle = ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.4;
  ctx.strokeRect(ph.x, ph.y, ph.w, ph.h);
  ctx.globalAlpha = 1;

  // caption
  ctx.fillStyle = ink; ctx.globalAlpha = 0.85;
  ctx.font = '600 24px "Palatino", Georgia, serif';
  spaced(ctx, card.caption.toUpperCase(), W / 2, H - 118, 4.4);
  ctx.font = '20px "Palatino", Georgia, serif'; ctx.globalAlpha = 0.6;
  spaced(ctx, card.sub.toUpperCase(), W / 2, H - 86, 3.2);
  ctx.globalAlpha = 1;

  vignette(ctx, W, H, 0.08);
  grain(ctx, W, H, card.seed, 9);
}

/* ---------- chapter hero (wide) ---------- */
function drawHero(ctx, W, H, card) {
  const P = card.palette;
  washes(ctx, W, H, P, card.seed + 40);
  // soft depth band lower third
  const g = ctx.createLinearGradient(0, H * 0.45, 0, H);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, P.deep.replace("rgb", "rgba").replace(")", ",0.12)"));
  ctx.fillStyle = g; ctx.fillRect(0, H * 0.45, W, H * 0.55);
  // large motif right-of-center in the deep ink tone
  ctx.save();
  MOTIFS[card.motif](ctx, W * 0.64, H * 0.52, H / 620, P.deep);
  ctx.restore();
  // thin frame
  ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.28; ctx.lineWidth = 2;
  ctx.strokeRect(38, 38, W - 76, H - 76);
  ctx.globalAlpha = 1;
  vignette(ctx, W, H, 0.12);
  grain(ctx, W, H, card.seed + 80, 10);
}

/* ---------- palette + content ---------- */
const CARDS = [
  {
    id: "experience", no: "N° 01", year: "MMXXVI", seed: 21,
    palette: {
      base: "#e2e7e1", ink: "#2e3a34", deep: "#31453b", deep2: "#5c7263", motif: "#e8efe7",
      wash: ["rgba(122,150,132,A)", "rgba(240,244,238,A)", "rgba(46,58,52,A)", "rgba(168,190,170,A)"],
      photoWash: ["rgba(20,38,30,A)", "rgba(52,76,62,A)", "rgba(34,54,44,A)"],
    },
    title: [
      { text: "THE", style: "georgia", size: 74, gap: 0, caps: true, ls: 26, color: "#3c4a42" },
      { text: "Experience", style: "times", size: 150, gap: 150, caps: false },
    ],
    titleY: 210, titleScale: 0.92,
    photo: { x: 66, y: 452, w: 728, h: 420 }, motif: "ecg", motifY: 0.52, motifW: 780,
    caption: "Twenty-two years at the table", sub: "The practice of presence",
  },
  {
    id: "professionalism", no: "N° 02", year: "MMXXVI", seed: 47,
    palette: {
      base: "#dcd8ea", ink: "#454160", deep: "#3d3860", deep2: "#7d77a8", motif: "#eceaf6",
      wash: ["rgba(126,118,178,A)", "rgba(244,242,250,A)", "rgba(69,65,96,A)", "rgba(160,152,204,A)"],
      photoWash: ["rgba(44,40,74,A)", "rgba(110,104,156,A)", "rgba(70,64,110,A)"],
    },
    title: [
      { text: "PROFESSIONALISM", style: "georgia", size: 58, gap: 0, caps: true, ls: 8, color: "#4a466e" },
      { text: "& the quiet code", style: "times", size: 86, gap: 96, caps: false },
    ],
    titleY: 226,
    photo: { x: 66, y: 452, w: 728, h: 420 }, motif: "stethoscope", motifY: 0.46, motifW: 700,
    caption: "Ethics worn like tailoring", sub: "Signed in every chart",
  },
  {
    id: "research", no: "N° 03", year: "MMXXVI", seed: 73,
    palette: {
      base: "#f6dfe7", ink: "#71374a", deep: "#5e2438", deep2: "#b0708a", motif: "#fbeef3",
      wash: ["rgba(178,90,124,A)", "rgba(252,240,246,A)", "rgba(113,55,74,A)", "rgba(224,160,184,A)"],
      photoWash: ["rgba(84,30,48,A)", "rgba(150,86,112,A)", "rgba(116,52,74,A)"],
    },
    title: [
      { text: "RESEARCH", style: "georgia", size: 96, gap: 0, caps: true, ls: 12, color: "#6d3049" },
      { text: "& trials", style: "times", size: 104, gap: 178, caps: false },
    ],
    titleY: 216,
    photo: { x: 66, y: 452, w: 728, h: 420 }, motif: "molecule", motifY: 0.5, motifW: 660,
    caption: "Forty-seven papers, one question", sub: "Evidence, kept like a promise",
  },
  {
    id: "education", no: "N° 04", year: "MMXXVI", seed: 99,
    palette: {
      base: "#f3eddd", ink: "#5f5844", deep: "#4a4330", deep2: "#948a68", motif: "#f8f3e6",
      wash: ["rgba(148,138,104,A)", "rgba(250,246,236,A)", "rgba(95,88,68,A)", "rgba(200,190,158,A)"],
      photoWash: ["rgba(64,57,40,A)", "rgba(130,120,88,A)", "rgba(94,86,60,A)"],
    },
    title: [
      { text: "THE EDUCATION", style: "georgia", size: 64, gap: 0, caps: true, ls: 10, color: "#57503b" },
      { text: "of a healer", style: "times", size: 96, gap: 106, caps: false },
    ],
    titleY: 230,
    photo: { x: 66, y: 452, w: 728, h: 420 }, motif: "education", motifY: 0.44, motifW: 640,
    caption: "Sixty fellows, one craft", sub: "The long apprenticeship",
  },
  {
    id: "specialties", no: "N° 05", year: "MMXXVI", seed: 131,
    palette: {
      base: "#dbe4ec", ink: "#39516a", deep: "#2c4258", deep2: "#6c8aa6", motif: "#e9f0f6",
      wash: ["rgba(108,138,166,A)", "rgba(240,246,251,A)", "rgba(57,81,106,A)", "rgba(150,176,198,A)"],
      photoWash: ["rgba(34,56,76,A)", "rgba(92,120,146,A)", "rgba(56,82,106,A)"],
    },
    title: [
      { text: "SPECIALTIES", style: "georgia", size: 76, gap: 0, caps: true, ls: 14, color: "#3c5670" },
      { text: "six gates of the heart", style: "times", size: 78, gap: 116, caps: false },
    ],
    titleY: 236, titleScale: 0.94,
    photo: { x: 66, y: 452, w: 728, h: 420 }, motif: "heartArt", motifY: 0.5, motifW: 640,
    caption: "Every rhythm, every repair", sub: "The second chances list",
  },
  {
    id: "honours", no: "N° 06", year: "MMXXVI", seed: 157,
    palette: {
      base: "#f4e8d2", ink: "#7c5f33", deep: "#5c451f", deep2: "#b3925c", motif: "#faf2e2",
      wash: ["rgba(179,146,92,A)", "rgba(252,246,234,A)", "rgba(124,95,51,A)", "rgba(224,203,160,A)"],
      photoWash: ["rgba(80,60,26,A)", "rgba(152,120,72,A)", "rgba(112,86,46,A)"],
    },
    title: [
      { text: "First, do", style: "script", size: 118, gap: 0, caps: false },
      { text: "no harm", style: "script", size: 118, gap: 128, caps: false },
    ],
    titleY: 246,
    photo: { x: 66, y: 452, w: 728, h: 420 }, motif: "burst", motifY: 0.5, motifW: 760,
    caption: "The oath & the honours", sub: "Medals follow the mission",
  },
];

/* ---------- render ---------- */
for (const card of CARDS) {
  const W = 860, H = 1040;
  const c1 = createCanvas(W, H);
  const x1 = c1.getContext("2d");
  drawCover(x1, W, H, card);
  fs.writeFileSync(path.join(OUT, `card-${card.id}.jpg`), c1.toBuffer("image/jpeg", 0.9));

  const W2 = 1920, H2 = 1150;
  const c2 = createCanvas(W2, H2);
  const x2 = c2.getContext("2d");
  drawHero(x2, W2, H2, card);
  fs.writeFileSync(path.join(OUT, `hero-${card.id}.jpg`), c2.toBuffer("image/jpeg", 0.88));
  console.log("✓", card.id);
}
console.log("Done →", OUT);
