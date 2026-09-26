const mongoose = require("mongoose");

async function connectDatabase() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ARIA-AI_DB";

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      appName: "ARIA"
    });
    global.ariaDatabaseStatus = "connected";
    console.log("MongoDB connected:", uri.replace(/\/\/.*@/, "//<credentials>@"));
  } catch (error) {
    global.ariaDatabaseStatus = "demo-mode";
    console.warn("MongoDB unavailable. ARIA will run without persistence.");
  }
}

module.exports = { connectDatabase };
