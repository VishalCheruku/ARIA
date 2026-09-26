const path = require("path");
const express = require("express");
const cors = require("cors");
const reportRoutes = require("./routes/reportRoutes");
const authRoutes = require("./routes/authRoutes");
/* Isolated Copilot integration surface: 3 narrow, rate-limited endpoints. */
const copilotRoutes = require("./routes/copilotRoutes");
/* Copilot runs as a child process, proxied at /copilot on this same origin. */
const copilotRunner = require("./services/copilotRunner");
const copilotProxy = require("./middleware/copilotProxy");

function createApp() {
  const app = express();

  app.use(cors());
  /* The copilot proxy MUST sit before express.json: it pipes raw request
     bodies to the Copilot backend (streaming SSE POSTs), while /api keeps
     normal JSON parsing. */
  app.use("/copilot", copilotProxy);
  app.use(express.json({ limit: "3mb" }));
  app.use(express.static(path.join(__dirname, "../../public")));
  app.use("/api", authRoutes);
  app.use("/api", reportRoutes);
  app.use("/api", copilotRoutes);

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      app: "ARIA AI",
      database: global.ariaDatabaseStatus || "unknown",
      copilot: copilotRunner.statusInfo(),
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
