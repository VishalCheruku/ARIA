const User = require("../models/User");
const { sanitizeUser, verifyToken } = require("../services/auth");

async function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);

    if (!user || user.status !== "active") {
      return res.status(401).json({ error: "Authentication is required." });
    }

    req.auth = payload;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: error.message || "Authentication is required." });
  }
}

function readToken(req) {
  const header = req.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();

  const cookie = req.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)aria_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function currentUser(req) {
  return sanitizeUser(req.user);
}

module.exports = { currentUser, requireAuth };
