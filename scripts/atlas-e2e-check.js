/* One-off end-to-end check: register/login a test user, upload the report
   fixture through the live API, then verify both docs exist in ATLAS. */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require(path.join(__dirname, "..", "node_modules", "mongodb"));

const BASE = "http://localhost:5000";
const EMAIL = "atlas-migration-test@aria.example";
const PASSWORD = "Test-Passw0rd!23";

async function api(route, options = {}) {
  const res = await fetch(BASE + route, options);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, headers: res.headers };
}

(async () => {
  /* 1. register (fall back to login if the account already exists) */
  let reg = await api("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Atlas Migration Test", email: EMAIL, password: PASSWORD, role: "care_coordinator" })
  });
  if (reg.status === 409) {
    reg = await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
  }
  if (reg.status !== 200 && reg.status !== 201) throw new Error("auth failed: " + JSON.stringify(reg.body));
  const token = reg.body.token;
  console.log("auth OK (" + reg.status + ")");

  /* 2. upload the report fixture with the session token */
  const filePath = path.join(__dirname, "..", "test", "fixtures", "noisy-report.png");
  const file = fs.readFileSync(filePath);
  const form = new FormData();
  form.append("document", new Blob([file], { type: "image/png" }), "noisy-report.png");
  const up = await api("/api/reports/analyze", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token },
    body: form
  });
  if (up.status !== 200) throw new Error("upload failed: " + JSON.stringify(up.body));
  const ids = up.body.ids || {};
  const reportId = ids.reportId || ids.report || up.body.report?.id || up.body.report?._id;
  console.log("upload OK, ids:", JSON.stringify(ids), "| risk:", JSON.stringify(up.body.risk?.level || up.body.risk?.score));
  console.log("response database field:", JSON.stringify(up.body.database));

  /* 3. verify both docs live in ATLAS */
  const atlas = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await atlas.connect();
  const db = atlas.db();
  const user = await db.collection("users").findOne({ email: EMAIL });
  const report = await db.collection("reports").findOne({ _id: require("mongodb").ObjectId.isValid(String(reportId)) ? new (require("mongodb").ObjectId)(String(reportId)) : reportId });
  const events = await db.collection("eventlogs").countDocuments({});
  console.log("ATLAS users has test account:", Boolean(user), user ? "(" + user.email + ")" : "");
  console.log("ATLAS reports has uploaded report:", Boolean(report), report ? "(risk " + (report.risk?.level || "?") + ")" : "");
  console.log("ATLAS eventlogs total:", events);
  await atlas.close();

  fs.writeFileSync(path.join(__dirname, "atlas-e2e-result.json"), JSON.stringify({
    email: EMAIL, reportId: String(reportId), userInAtlas: Boolean(user), reportInAtlas: Boolean(report)
  }, null, 2));
  process.exit(user && report ? 0 : 1);
})().catch(e => { console.error("E2E FAILED:", e.message); process.exit(1); });
