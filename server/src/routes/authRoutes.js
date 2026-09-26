const express = require("express");
const User = require("../models/User");
const { currentUser, requireAuth } = require("../middleware/auth");
const {
  hashPassword,
  normalizeEmail,
  sanitizeUser,
  signToken,
  validateEmail,
  validatePassword,
  verifyPassword
} = require("../services/auth");

const router = express.Router();

router.post("/auth/register", async (req, res) => {
  if (String(process.env.AUTH_ALLOW_REGISTRATION).toLowerCase() === "false") {
    return res.status(403).json({ error: "Registration is disabled. Ask an administrator to create accounts." });
  }

  const validation = validateRegistration(req.body);
  if (validation) return res.status(400).json({ error: validation });

  const email = normalizeEmail(req.body.email);

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(409).json({ error: "An account already exists for this email." });

    const user = await User.create({
      name: req.body.name.trim(),
      email,
      passwordHash: await hashPassword(req.body.password),
      role: req.body.role || "care_coordinator"
    });
    const session = signToken(user);
    setSessionCookie(res, session.token, session.expiresAt);

    res.status(201).json({ user: sanitizeUser(user), ...session });
  } catch (error) {
    res.status(503).json({ error: "Account could not be created.", detail: error.message });
  }
});

router.post("/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!validateEmail(email) || typeof password !== "string" || !password) {
    return res.status(400).json({ error: "Enter a valid email and password." });
  }

  try {
    const user = await User.findOne({ email }).select("+passwordHash");
    const passwordMatches = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !passwordMatches) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    if (user.status !== "active") {
      return res.status(403).json({ error: "This account is disabled." });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const session = signToken(user);
    setSessionCookie(res, session.token, session.expiresAt);

    res.json({ user: sanitizeUser(user), ...session });
  } catch (error) {
    res.status(503).json({ error: "Login is unavailable right now.", detail: error.message });
  }
});

router.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: currentUser(req) });
});

router.post("/auth/logout", (_req, res) => {
  res.cookie("aria_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0)
  });
  res.json({ ok: true });
});

function validateRegistration(body = {}) {
  const name = String(body.name || "").trim();
  const email = normalizeEmail(body.email);
  const passwordError = validatePassword(body.password);
  const allowedRoles = new Set(["admin", "clinician", "care_coordinator"]);

  if (name.length < 2) return "Name must be at least 2 characters.";
  if (!validateEmail(email)) return "Enter a valid email address.";
  if (passwordError) return passwordError;
  if (body.role && !allowedRoles.has(body.role)) return "Role is not supported.";
  return null;
}

function setSessionCookie(res, token, expiresAt) {
  res.cookie("aria_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expiresAt)
  });
}

module.exports = router;
