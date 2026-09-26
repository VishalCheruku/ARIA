const assert = require("node:assert/strict");
const test = require("node:test");
const {
  hashPassword,
  signToken,
  validateEmail,
  validatePassword,
  verifyPassword,
  verifyToken
} = require("../server/src/services/auth");

test("hashPassword stores a verifiable non-plain-text password", async () => {
  const hash = await hashPassword("Careplan123");

  assert.notEqual(hash, "Careplan123");
  assert.match(hash, /^scrypt:/);
  assert.equal(await verifyPassword("Careplan123", hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});

test("signToken and verifyToken round-trip user identity", () => {
  process.env.AUTH_TOKEN_SECRET = "test-secret";

  const { token, expiresAt } = signToken({
    _id: "user-123",
    name: "Dr Rao",
    email: "rao@example.com",
    role: "clinician"
  }, { expiresIn: 60 });
  const payload = verifyToken(token);

  assert.equal(payload.sub, "user-123");
  assert.equal(payload.email, "rao@example.com");
  assert.equal(payload.role, "clinician");
  assert.ok(Date.parse(expiresAt) > Date.now());
});

test("validation helpers reject weak credentials", () => {
  assert.equal(validateEmail("clinician@example.com"), true);
  assert.equal(validateEmail("not-an-email"), false);
  assert.equal(validatePassword("short1"), "Password must be at least 8 characters.");
  assert.equal(validatePassword("passwordonly"), "Password must include at least one letter and one number.");
  assert.equal(validatePassword("Password1"), null);
});
