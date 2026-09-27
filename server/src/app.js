const path = require("path");
const zlib = require("zlib");
const express = require("express");
const cors = require("cors");
const reportRoutes = require("./routes/reportRoutes");
const authRoutes = require("./routes/authRoutes");
/* Isolated Copilot integration surface: 3 narrow, rate-limited endpoints. */
const copilotRoutes = require("./routes/copilotRoutes");
/* Copilot runs as a child process, proxied at /copilot on this same origin. */
const copilotRunner = require("./services/copilotRunner");
const copilotProxy = require("./middleware/copilotProxy");

const COMPRESSIBLE_TYPE = /^text\/|application\/(json|javascript|xml|manifest\+json|rss\+xml)|image\/svg\+xml/;
const GZIP_CHUNK_LIMIT = 8 * 1024 * 1024; /* larger than any page asset; media streams pass through */

/*
  Dependency-free gzip for compressible responses (HTML/CSS/JS/JSON/SVG).
  Buffers the body, gzips once, and re-stamps Content-Length. Mounted AFTER
  the /copilot proxy so the SSE stream is never buffered, and skips
  audio/video (they arrive as range streams from express.static untouched).
*/
function gzipCompression() {
  return function gzip(req, res, next) {
    if (!/\bgzip\b/i.test(String(req.headers["accept-encoding"] || ""))) return next();
    /* HEAD has no body: gzipping an empty buffer would re-stamp a bogus Content-Length */
    if (req.method === "HEAD") return next();

    const chunks = [];
    let total = 0;
    let mode = null; /* null = undecided, "gzip", "pass" */
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    function decide() {
      if (mode) return mode;
      const type = String(res.getHeader("Content-Type") || "application/octet-stream");
      const declaredLength = Number(res.getHeader("Content-Length") || 0);
      mode =
        COMPRESSIBLE_TYPE.test(type) &&
        !res.getHeader("Content-Encoding") &&
        !String(res.getHeader("Cache-Control") || "").includes("no-transform") &&
        declaredLength <= GZIP_CHUNK_LIMIT &&
        total <= GZIP_CHUNK_LIMIT
          ? "gzip"
          : "pass";
      if (mode === "gzip") {
        res.setHeader("Content-Encoding", "gzip");
        res.setHeader("Vary", "Accept-Encoding");
        res.removeHeader("Content-Length");
      }
      return mode;
    }

    res.write = function (chunk, encoding, callback) {
      if (typeof encoding === "function") { callback = encoding; encoding = undefined; }
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || "utf8");
      total += buffer.length;
      if (!mode && total > GZIP_CHUNK_LIMIT) mode = "pass";
      if (decide() === "gzip") {
        chunks.push(buffer);
        if (callback) callback();
        return true;
      }
      return originalWrite(chunk, encoding, callback);
    };

    res.end = function (chunk, encoding, callback) {
      if (typeof chunk === "function") { callback = chunk; chunk = undefined; }
      else if (typeof encoding === "function") { callback = encoding; encoding = undefined; }
      if (chunk !== undefined) res.write(chunk, encoding);
      if (decide() === "gzip") {
        const raw = Buffer.concat(chunks);
        zlib.gzip(raw, { level: 6 }, (error, zipped) => {
          if (error) {
            res.setHeader("Content-Encoding", "identity");
            res.setHeader("Content-Length", raw.length);
            originalEnd(raw, callback);
            return;
          }
          res.setHeader("Content-Length", zipped.length);
          originalEnd(zipped, callback);
        });
        return;
      }
      return originalEnd(callback);
    };

    next();
  };
}

/* Far-future caching for fingerprints-free statics: media/images never change,
   code changes weekly (SW + network-first HTML keep updates flowing). */
function staticCacheHeaders(res, filePath) {
  if (/\.(mp4|mp3|webm|ogg|png|jpe?g|gif|webp|ico|svg|woff2?)$/i.test(filePath)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else if (/\.css$/i.test(filePath)) {
    res.setHeader("Cache-Control", "public, max-age=604800");
  } else if (/\.js$/i.test(filePath)) {
    res.setHeader("Cache-Control", "public, max-age=86400");
  } else if (/\.json$/i.test(filePath)) {
    res.setHeader("Cache-Control", "public, max-age=3600");
  } else if (/\.html?$/i.test(filePath)) {
    res.setHeader("Cache-Control", "no-cache");
  }
}

function createApp() {
  const app = express();

  app.use(cors());
  /* The copilot proxy MUST sit before express.json: it pipes raw request
     bodies to the Copilot backend (streaming SSE POSTs), while /api keeps
     normal JSON parsing. */
  app.use("/copilot", copilotProxy);
  /* gzip sits after the copilot proxy: /copilot SSE and media range streams
     pass through untouched; pages, assets and API JSON shrink ~70-80%. */
  app.use(gzipCompression());
  app.use(express.json({ limit: "3mb" }));
  app.use(express.static(path.join(__dirname, "../../public"), { setHeaders: staticCacheHeaders }));
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
