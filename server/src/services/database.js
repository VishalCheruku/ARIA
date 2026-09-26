const mongoose = require("mongoose");

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    global.ariaDatabaseStatus = "demo-mode";
    console.warn("MONGODB_URI is not set. ARIA will run without persistence.");
    return;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      appName: "ARIA"
    });
    global.ariaDatabaseStatus = "connected";
    console.log("MongoDB connected:", uri.replace(/\/\/.*@/, "//<credentials>@"));
  } catch (error) {
    global.ariaDatabaseStatus = "demo-mode";
    console.warn(`MongoDB unreachable (${error.message}). ARIA will run without persistence.`);
  }
}

module.exports = { connectDatabase };
