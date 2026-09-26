/* One-off: remove the e2e test data from Atlas, leaving migrated data intact. */
require("dotenv").config();
const { MongoClient, ObjectId } = require("../node_modules/mongodb");

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await c.connect();
  const db = c.db();
  // Everything written to Atlas after the migration is this e2e run's test data
  const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
  const byTime = { _id: { $gt: ObjectId.createFromTime(Math.floor(cutoff.getTime() / 1000)) } };
  const r1 = await db.collection("users").deleteOne({ email: "atlas-migration-test@aria.example" });
  const r2 = await db.collection("reports").deleteMany(byTime);
  const r3 = await db.collection("patients").deleteMany(byTime);
  const r4 = await db.collection("eventlogs").deleteMany(byTime);
  console.log("deleted test data -> users:", r1.deletedCount, "reports:", r2.deletedCount,
    "patients:", r3.deletedCount, "eventlogs:", r4.deletedCount);
  for (const col of ["users", "reports", "patients", "eventlogs"]) {
    console.log("Atlas", col, "=", await db.collection(col).countDocuments({}), "docs (migrated data intact)");
  }
  await c.close();
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
