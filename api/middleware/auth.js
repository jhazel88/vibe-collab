// ═══════════════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE — JWT-based authentication and role-based access control
//
// Supports three modes (checked in order):
//   1. httpOnly session cookie (SPA — set by magic link verify flow)
//   2. JWT Bearer tokens (API clients) — Authorization: Bearer <token>
//   3. Dev bypass (development) — x-dev-user header or DEV_USER_ID env var
//
// Role hierarchy: viewer < editor < admin
//
// Donor: EU Digital Strategy Tracker api/middleware/auth.js
// Changes: removed tier-gate (not needed in Sprint 1), removed app_users
//   DB lookup from /me endpoint (no app_users table yet), simplified role
//   hierarchy (removed senior_editor), updated domain references
// ═══════════════════════════════════════════════════════════════════════════

import crypto from "crypto";

// ── Configuration ─────────────────────────────────────────────────────────

const DEV_JWT_SECRET = "hta-dev-secret-change-in-production";
const JWT_SECRET = process.env.JWT_SECRET || DEV_JWT_SECRET;
const JWT_EXPIRY = parseInt(process.env.JWT_EXPIRY_HOURS || "24", 10) * 3600;
const IS_DEV = process.env.NODE_ENV === "development";
const IS_TEST = process.env.NODE_ENV === "test" || (typeof process.env.VITEST !== "undefined");

if (!IS_DEV && !IS_TEST) {
  const configuredSecret = process.env.JWT_SECRET?.trim();
  if (!configuredSecret || configuredSecret === DEV_JWT_SECRET) {
    throw new Error("JWT_SECRET must be set to a strong value in production.");
  }
}

const ROLE_HIERARCHY = ["viewer", "editor", "admin"];

function roleLevel(role) {
  const idx = ROLE_HIERARCHY.indexOf(role);
  return idx === -1 ? 0 : idx;
}

// ── JWT helpers (minimal, no external deps) ───────────────────────────────

function base64url(str) {
  return Buffer.from(str).toString("base64url");
}

function base64urlDecode(str) {
  return Buffer.from(str, "base64url").toString("utf8");
}

function hmacSign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createToken(user) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({
    sub: user.user_id || user.id,
    email: user.email,
    name: user.display_name || user.name,
    role: user.role || "viewer",
    iat: now,
    exp: now + JWT_EXPIRY,
  }));
  const signature = hmacSign(`${header}.${payload}`, JWT_SECRET);
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, sig] = parts;
  const expectedSig = hmacSign(`${header}.${payload}`, JWT_SECRET);

  // Constant-time comparison
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const decoded = JSON.parse(base64urlDecode(payload));

  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return decoded;
}

// ── Dev user fallback ─────────────────────────────────────────────────────

const DEV_USER = {
  sub: "dev-user-001",
  email: "dev@hta.local",
  name: "Dev User",
  role: process.env.DEV_ADMIN === "true" ? "admin" : "viewer",
};

function getDevUser(req) {
  if (!IS_DEV) return null;

  const devHeader = req.headers["x-dev-user"];
  if (devHeader) {
    try {
      return JSON.parse(devHeader);
    } catch {
      return { ...DEV_USER, name: devHeader, email: `${devHeader}@hta.local` };
    }
  }

  if (process.env.DEV_USER_ID) {
    return { ...DEV_USER, sub: process.env.DEV_USER_ID };
  }

  return DEV_USER;
}

// ── Cookie helpers ──────────────────────────────────────────────────────

export const SESSION_COOKIE = "session";

const IS_PROD_ENV = process.env.NODE_ENV === "production";

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: IS_PROD_ENV,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: IS_PROD_ENV,
    sameSite: "lax",
    path: "/",
  });
}

// ── Middleware: authenticate ──────────────────────────────────────────────

export function authenticate(req, _res, next) {
  // 1. Try session cookie first
  const cookieToken = req.cookies?.[SESSION_COOKIE];
  if (cookieToken) {
    const decoded = verifyToken(cookieToken);
    if (decoded) {
      req.user = decoded;
      return next();
    }
  }

  // 2. Try Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
      return next();
    }
  }

  // 3. Dev fallback
  const devUser = getDevUser(req);
  if (devUser) {
    req.user = devUser;
    return next();
  }

  req.user = null;
  next();
}

// ── Middleware: requireAuth ──────────────────────────────────────────────

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: "Authentication required",
      code: "AUTH_REQUIRED",
    });
  }
  next();
}

// ── Middleware: requireRole ──────────────────────────────────────────────

export function requireRole(minimumRole) {
  const minLevel = roleLevel(minimumRole);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    if (roleLevel(req.user.role) < minLevel) {
      return res.status(403).json({
        error: `Requires ${minimumRole} role or higher`,
        code: "INSUFFICIENT_ROLE",
        required: minimumRole,
        current: req.user.role,
      });
    }

    next();
  };
}

// ── Auth routes ──────────────────────────────────────────────────────────

import { Router } from "express";

export const authRoutes = Router();

// POST /api/auth/login — Dev login (disabled in production)
authRoutes.post("/login", (req, res) => {
  if (!IS_DEV) {
    return res.status(403).json({
      error: "Dev login is disabled in production",
      code: "LOGIN_DISABLED",
    });
  }

  const { email, name, role = "editor" } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  if (!ROLE_HIERARCHY.includes(role)) {
    return res.status(400).json({
      error: "Invalid role",
      valid: ROLE_HIERARCHY,
    });
  }

  const user = {
    user_id: crypto.createHash("sha256").update(email).digest("hex").slice(0, 12),
    email,
    display_name: name || email.split("@")[0],
    role,
  };

  const token = createToken(user);

  res.json({
    token,
    user: {
      id: user.user_id,
      email: user.email,
      name: user.display_name,
      role: user.role,
    },
    expires_in: JWT_EXPIRY,
  });
});

// GET /api/auth/me — Return current user info
authRoutes.get("/me", authenticate, requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.sub,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
    },
  });
});

// POST /api/auth/refresh — Refresh an expiring token
authRoutes.post("/refresh", authenticate, requireAuth, (req, res) => {
  const user = {
    user_id: req.user.sub,
    email: req.user.email,
    display_name: req.user.name,
    role: req.user.role,
  };

  const token = createToken(user);

  if (req.cookies?.[SESSION_COOKIE]) {
    setSessionCookie(res, token);
  }

  res.json({
    token,
    user: {
      id: user.user_id,
      email: user.email,
      name: user.display_name,
      role: user.role,
    },
    expires_in: JWT_EXPIRY,
  });
});

// POST /api/auth/logout — Clear session
authRoutes.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});
