/*
  Copilot proxy — exposes the Copilot backend (separate uvicorn process) under
  the MAIN app's origin at /copilot/*, so the whole platform runs on one port:

      main app  /copilot/api/chat     ->  copilot  /api/chat
      main app  /copilot/chat         ->  copilot  /chat          (SPA)
      main app  /copilot/assets/*     ->  copilot  /assets/*      (SPA)

  Streaming-safe (SSE): request and response bodies are piped raw — mounted
  BEFORE express.json so POST bodies are never consumed. No new dependencies.

  When the Copilot process is down, browser GETs get a calm HTML notice and
  API calls get a calm 502 JSON — never a stack trace, never a hang (spec §2
  principle 4). The main app's own routes are untouched.
*/

const http = require("http");
const copilotRunner = require("../services/copilotRunner");

const CALM_MESSAGE = "Copilot is temporarily unavailable. Your dashboard and care plan are unaffected.";

function respondCalm(req, res) {
  const wantsHtml = req.method === "GET" && String(req.headers.accept || "").includes("text/html");
  if (wantsHtml) {
    res.status(502).type("html").send(
`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ARIA Copilot</title>
<style>body{font-family:Inter,'Segoe UI',system-ui,sans-serif;background:#f0fdfa;color:#134e4a;
display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:24px}
.card{max-width:420px}h1{font-size:18px}p{font-size:14px;line-height:1.6;color:#475569}</style></head>
<body><div class="card"><h1>ARIA Recovery Copilot</h1>
<p>${CALM_MESSAGE}</p></div></body></html>`
    );
    return;
  }
  res.status(502).json({ error: CALM_MESSAGE });
}

function proxy(req, res) {
  if (copilotRunner.state.status !== "up") {
    respondCalm(req, res);
    return;
  }

  /* Mounted via app.use("/copilot", ...): Express has already stripped the
     mount prefix from req.url. */
  const upstreamPath = req.url || "/";

  const upstream = http.request(
    {
      host: "127.0.0.1",
      port: copilotRunner.state.port,
      path: upstreamPath,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${copilotRunner.state.port}` }
    },
    upstreamResponse => {
      res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(res);
    }
  );

  upstream.on("error", () => respondCalm(req, res));
  req.pipe(upstream);
}

module.exports = proxy;
