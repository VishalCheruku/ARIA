#!/usr/bin/env node
/* Builds public/data/medicines.json from the curated seeds in medicine-seeds/.
   Every seed is a real molecule (salt) with plain-word explanation, real
   Indian brand products and real strengths. The builder expands each molecule
   into directory entries (salt-strength entries + brand entries), sorted A-Z.
   Run: node scripts/build_medicine_directory.js */
const fs = require("fs");
const path = require("path");

const SEED_FILES = [
  "pain-fever", "antibiotics", "gi-acidity", "diabetes-hormones", "heart-bp",
  "womens-health", "vitamins-bones", "allergy-respiratory", "skin-eye-ent",
  "brain-mind", "urology-emergency", "infections", "combos",
  "brain-mind2", "cardio-extra", "gi-extra", "derma-eye-extra", "onco-vaccines",
  "misc-extra", "hospital-essentials", "_expansions",
];

const seedsDir = path.join(__dirname, "medicine-seeds");
const molecules = [];
const problems = [];

for (const f of SEED_FILES) {
  if (f === "_expansions") continue; // patch maps, applied below
  const list = require(path.join(seedsDir, f + ".js"));
  list.forEach((m, i) => {
    if (!m.salt || !m.cat || !m.simple) problems.push(`${f}[${i}]: missing salt / cat / simple`);
    molecules.push(m);
  });
}

/* Patch maps: extra real strengths / brands for molecules defined in other files. */
const expansions = require(path.join(seedsDir, "_expansions.js"));
const bySalt = new Map(molecules.map(m => [m.salt, m]));
for (const [salt, extra] of Object.entries(expansions)) {
  const m = bySalt.get(salt);
  if (!m) { problems.push(`expansion target missing: "${salt}"`); continue; }
  if (extra.strengths) m.strengths = [...(m.strengths || []), ...extra.strengths];
  if (extra.brands) m.brands = [...(m.brands || []), ...extra.brands];
}

molecules.forEach((m, i) => {
  m.id = m.salt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
});

const nameSeen = new Map();
let entries = [];
molecules.forEach((m, mi) => {
  const strengths = m.strengths && m.strengths.length ? m.strengths : [];
  if (strengths.length) {
    strengths.forEach(s => entries.push({ n: `${m.salt} ${s}`, m: mi, t: "salt" }));
  } else {
    entries.push({ n: m.salt, m: mi, t: "salt" });
  }
  (m.brands || []).forEach(b => entries.push({ n: b, m: mi, t: "brand" }));
  if (!(m.brands || []).length && !strengths.length) problems.push(`${m.salt}: has no entries (add strengths or brands)`);
});

const deduped = [];
for (const e of entries) {
  const k = e.n.toLowerCase();
  if (nameSeen.has(k)) continue; /* same product listed for two molecules — keep the first */
  nameSeen.set(k, e.m);
  deduped.push(e);
}
entries = deduped;

entries.sort((a, b) => a.n.localeCompare(b.n, "en", { sensitivity: "base", numeric: true }));

const out = {
  generated: new Date().toISOString().slice(0, 10),
  moleculeCount: molecules.length,
  entries,
  molecules: molecules.map(m => ({
    salt: m.salt, cat: m.cat, kind: m.kind || "", simple: m.simple,
    uses: m.uses || [], how: m.how || "", watch: m.watch || [], alert: m.alert || "",
    brands: m.brands || [],
  })),
};

const dest = path.join(__dirname, "..", "public", "data", "medicines.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`molecules: ${out.moleculeCount}`);
console.log(`entries:   ${entries.length}`);
console.log(`size:      ${(fs.statSync(dest).size / 1024).toFixed(0)} KB`);
if (problems.length) {
  console.log("PROBLEMS:");
  problems.forEach(p => console.log(" -", p));
  process.exitCode = 1;
}
if (entries.length < 2000) console.log(`NOTE: below the 2000-entry target (${entries.length})`);
