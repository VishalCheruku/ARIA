const assert = require("node:assert/strict");
const test = require("node:test");
const { createApp } = require("../server/src/app");

function listen(app) {
  return new Promise(resolve => {
    const server = app.listen(0, () => resolve(server));
  });
}

async function request(server, path, options = {}) {
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const body = await response.json();
  return { response, body };
}

test("auth routes validate malformed login payloads", async () => {
  const server = await listen(createApp());
  try {
    const { response, body } = await request(server, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "bad", password: "" })
    });

    assert.equal(response.status, 400);
    assert.equal(body.error, "Enter a valid email and password.");
  } finally {
    server.close();
  }
});

test("registration stays disabled until configured", async () => {
  const previous = process.env.AUTH_ALLOW_REGISTRATION;
  process.env.AUTH_ALLOW_REGISTRATION = "false";
  const server = await listen(createApp());

  try {
    const { response, body } = await request(server, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Dr Rao",
        email: "rao@example.com",
        password: "Careplan123"
      })
    });

    assert.equal(response.status, 403);
    assert.match(body.error, /Registration is disabled/i);
  } finally {
    if (previous === undefined) delete process.env.AUTH_ALLOW_REGISTRATION;
    else process.env.AUTH_ALLOW_REGISTRATION = previous;
    server.close();
  }
});

test("protected auth profile endpoint requires a token", async () => {
  const server = await listen(createApp());
  try {
    const { response, body } = await request(server, "/api/auth/me");

    assert.equal(response.status, 401);
    assert.match(body.error, /token|Authentication/i);
  } finally {
    server.close();
  }
});
