/*
  Copilot process runner — starts the ARIA Recovery Copilot backend
  (FastAPI/uvicorn) as a CHILD PROCESS of the main Node server, so
  `npm run dev` / `npm start` brings up the whole platform at once.

  Isolation contract (spec §4, preserved in spirit):
   - The Copilot is still a SEPARATE PROCESS. If it crashes, hangs, or is
     missing (no Python on the machine), this runner logs loudly and the main
     dashboard keeps working exactly as before — the /copilot proxy answers
     with a calm 502 and the Ask ARIA button says "temporarily unavailable".
   - One deliberate coupling point remains the shared COPILOT_SIGNING_SECRET,
     which the child inherits from this process's environment.

  Lookup order for the interpreter:
    1. COPILOT_PYTHON env var (set in the Render Docker image)
    2. venv inside aria-recovery-copilot/backend (local dev, Windows/Linux)
    3. "python3" then "python" on PATH

  Set COPILOT_ENABLED=false to disable the Copilot entirely.
*/

const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

/* Local dev: the copilot repo lives next to server/. Container builds set
   COPILOT_BACKEND_DIR (e.g. /copilot) instead. (services -> src -> server ->
   repo root = three levels up.) */
const BACKEND_DIR = process.env.COPILOT_BACKEND_DIR
  ? path.resolve(process.env.COPILOT_BACKEND_DIR)
  : path.join(__dirname, "..", "..", "..", "aria-recovery-copilot", "backend");
const FRONTEND_DIST = path.join(BACKEND_DIR, "..", "frontend", "dist");

const RESTART_DELAY_MS = 3000;
const MAX_RESTARTS = 5;
const READINESS_TIMEOUT_MS = 30000;

const state = {
  enabled: String(process.env.COPILOT_ENABLED ?? "true").toLowerCase() !== "false",
  port: Number(process.env.COPILOT_PORT || 8000),
  child: null,
  status: "disabled", // disabled | starting | up | down
  restarts: 0,
  startedAt: null
};

function log(message) {
  console.log(`[copilot] ${message}`);
}

function findPython() {
  const candidates = [];
  if (process.env.COPILOT_PYTHON) candidates.push(process.env.COPILOT_PYTHON);
  const venvPython = process.platform === "win32"
    ? path.join(BACKEND_DIR, ".venv", "Scripts", "python.exe")
    : path.join(BACKEND_DIR, ".venv", "bin", "python");
  candidates.push(venvPython, "python3", "python");
  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch (_error) {
      /* try the next candidate */
    }
  }
  return null;
}

function probeHealth(timeoutMs = 1500) {
  return new Promise(resolve => {
    const request = http.get(
      { host: "127.0.0.1", port: state.port, path: "/api/health", timeout: timeoutMs },
      response => {
        response.resume();
        resolve(response.statusCode === 200);
      }
    );
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

async function waitForReadiness() {
  const deadline = Date.now() + READINESS_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await probeHealth()) return true;
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  return false;
}

function buildEnv() {
  const env = { ...process.env, COPILOT_SIGNING_SECRET: process.env.COPILOT_SIGNING_SECRET || "" };
  /* Serve the built SPA from the backend when a frontend build exists and
     STATIC_DIR was not pinned by the environment (container builds). */
  if (!env.STATIC_DIR && fs.existsSync(path.join(FRONTEND_DIST, "index.html"))) {
    env.STATIC_DIR = FRONTEND_DIST;
  }
  return env;
}

async function start() {
  if (!state.enabled) {
    log("disabled (COPILOT_ENABLED=false) — the Ask ARIA button will show unavailable");
    return;
  }

  /* A copilot already listening (e.g. started manually) is adopted as-is. */
  if (await probeHealth()) {
    state.status = "up";
    log(`already running on port ${state.port} — adopted`);
    return;
  }

  const python = findPython();
  if (!python) {
    state.status = "down";
    log("Python interpreter not found — Copilot disabled for this run. " +
        "The dashboard is unaffected; set COPILOT_PYTHON or install deps in aria-recovery-copilot/backend/.venv");
    return;
  }

  spawnChild(python);
  const ready = await waitForReadiness();
  if (ready) {
    state.status = "up";
    state.startedAt = new Date().toISOString();
    log(`up on http://127.0.0.1:${state.port} (proxied at /copilot)`);
  } else {
    state.status = "down";
    log("did not become healthy in time — continuing without it; the dashboard is unaffected");
  }
}

function spawnChild(python) {
  log(`starting: ${python} -m uvicorn app.main:app --port ${state.port}`);
  state.child = spawn(python, ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(state.port)], {
    cwd: BACKEND_DIR,
    env: buildEnv(),
    stdio: ["ignore", "pipe", "pipe"]
  });

  state.child.stdout.on("data", data => process.stdout.write(`[copilot:uvicorn] ${data}`));
  state.child.stderr.on("data", data => process.stderr.write(`[copilot:uvicorn] ${data}`));

  state.child.on("exit", (code, signal) => {
    state.child = null;
    if (state.status !== "disabled") state.status = "down";
    if (state.stopping) return;
    log(`process exited (code=${code} signal=${signal})`);
    if (state.restarts < MAX_RESTARTS) {
      state.restarts += 1;
      log(`restarting in ${RESTART_DELAY_MS}ms (attempt ${state.restarts}/${MAX_RESTARTS})`);
      setTimeout(() => {
        if (!state.stopping) spawnChild(findPython() || python);
      }, RESTART_DELAY_MS);
    } else {
      log("gave up restarting — Copilot stays down; the main app is unaffected");
    }
  });
}

async function stop() {
  state.stopping = true;
  if (state.child) {
    log("stopping child process");
    state.child.kill();
  }
}

function statusInfo() {
  return {
    enabled: state.enabled,
    status: state.status,
    port: state.port,
    proxiedAt: "/copilot",
    restarts: state.restarts
  };
}

module.exports = { start, stop, statusInfo, probeHealth, state };
