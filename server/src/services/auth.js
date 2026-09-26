const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);
const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 8 * 60 * 60);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  const [scheme, salt, hash] = String(storedHash || "").split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = await scrypt(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function signToken(user, options = {}) {
  const expiresIn = Number(options.expiresIn || TOKEN_TTL_SECONDS);
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(user._id || user.id),
    email: user.email,
    name: user.name,
    role: user.role,
    iat: now,
    exp: now + expiresIn
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = createSignature(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(payload.exp * 1000).toISOString()
  };
}

function verifyToken(token) {
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Authentication token is missing or malformed.");
  }

  const expected = createSignature(encodedPayload);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    throw new Error("Authentication token is invalid.");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Authentication token has expired.");
  }
  return payload;
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: String(user._id || user.id || user.sub),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status || "active"
  };
}

function getTokenSecret() {
  return process.env.AUTH_TOKEN_SECRET || "aria-local-development-secret-change-me";
}

function createSignature(value) {
  return crypto.createHmac("sha256", getTokenSecret()).update(value).digest("base64url");
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

module.exports = {
  hashPassword,
  normalizeEmail,
  sanitizeUser,
  signToken,
  validateEmail,
  validatePassword,
  verifyPassword,
  verifyToken
};
