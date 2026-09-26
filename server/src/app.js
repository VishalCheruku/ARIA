const path = require("path");
const express = require("express");
const cors = require("cors");
const reportRoutes = require("./routes/reportRoutes");
const authRoutes = require("./routes/authRoutes");

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "3mb" }));
  app.use(express.static(path.join(__dirname, "../../public")));
  app.use("/api", authRoutes);
  app.use("/api", reportRoutes);

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      app: "ARIA AI",
      database: global.ariaDatabaseStatus || "unknown",
      auth: {
        enabled: true,
        registration: process.env.AUTH_ALLOW_REGISTRATION === "true"
      },
      ocr: {
        engine: "Tesseract.js",
        language: "eng",
        modes: ["image", "scanned-pdf", "selectable-pdf", "txt", "json"],
        preprocessing: true,
        fallback: true,
        capabilities: {
          imageOcr: true,
          scannedPdfOcr: true,
          selectablePdfTextExtraction: true,
          preprocessing: ["resize", "grayscale", "contrast", "threshold"],
          weakConfidenceSecondPass: true,
          perPagePdfProcessing: true,
          metrics: ["confidence", "quality", "pages", "processedPages", "passes", "characters", "words"]
        }
      }
    });
  });

  app.use((_req, res) => {
    res.sendFile(path.join(__dirname, "../../public/index.html"));
  });

  return app;
}

module.exports = { createApp };
