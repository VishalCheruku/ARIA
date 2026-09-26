/*
  Copilot embedded-mode proxy tests. These run WITHOUT Python: when the
  Copilot child process is down (COPILOT_ENABLED=false), the proxy must
  return calm failures — a friendly HTML page for browsers, JSON for APIs —
  and the main app's own routes must be completely unaffected.
*/
process.env.COPILOT_ENABLED = "false";
process.env.COPILOT_SIGNING_SECRET = process.env.COPILOT_SIGNING_SECRET || "test-copilot-signing-secret-0123456789abcdef";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createApp } = require("../server/src/app");

function listen(app) {
  return new Promise(resolve => {
    const server = app.listen(0, () => resolve(server));
  });
}

test("copilot proxy answers browsers with a calm page when the Copilot is down", async () => {
  const server = await listen(createApp());
  try {
    /* A browser navigation sends Accept: text/html; a bare fetch sends * /* */
    const response = await fetch(`http://127.0.0.1:${server.address().port}/copilot/chat?token=x`, {
      headers: { accept: "text/html,application/xhtml+xml" }
    });
    const body = await response.text();
    assert.equal(response.status, 502);
    assert.match(body, /Copilot is temporarily unavailable/);
    assert.match(response.headers.get("content-type"), /text\/html/);
  } finally {
    server.close();
  }
});

test("copilot proxy answers API calls with calm JSON when the Copilot is down", async () => {
  const server = await listen(createApp());
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/copilot/api/health`);
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.match(body.error, /temporarily unavailable/);
  } finally {
    server.close();
  }
});

test("main app routes are unaffected while the Copilot is down", async () => {
  const server = await listen(createApp());
  try {
    const health = await fetch(`http://127.0.0.1:${server.address().port}/health`);
    const body = await health.json();
    assert.equal(health.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.copilot.enabled, false);
    assert.equal(body.copilot.status, "disabled");

    const login = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad", password: "" })
    });
    assert.equal(login.status, 400);
  } finally {
    server.close();
  }
});
