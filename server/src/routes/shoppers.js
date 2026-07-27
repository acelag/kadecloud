import bcrypt from "bcrypt";
import crypto from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import { query } from "../config/db.js";
import { config } from "../config/env.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/email.js";
import { getJwtSecret } from "../utils/authToken.js";

const router = express.Router();
const saltRounds          = 12;
const VERIFY_EXPIRES_MS   = 24 * 60 * 60 * 1000; // 24 hours

function makeToken() {
  const raw  = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

async function dispatchShopperVerification(shopperId, email, storeSlug = "") {
  const { raw, hash } = makeToken();
  const expiresAt = new Date(Date.now() + VERIFY_EXPIRES_MS);
  await query(
    `UPDATE shoppers
       SET email_verification_token = $1, email_verification_expires = $2
     WHERE id = $3`,
    [hash, expiresAt, shopperId]
  );
  const basePath  = storeSlug ? `/store/${storeSlug}` : "";
  const verifyUrl = `${config.publicBaseUrl}${basePath}/verify-email?token=${raw}`;
  sendVerificationEmail({ to: email, verifyUrl }).catch(() => {});
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function signShopperToken(shopper) {
  return jwt.sign(
    { type: "shopper", shopperId: shopper.id, email: shopper.email },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "30d" }
  );
}

export function requireShopper(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Sign-in required" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.type !== "shopper" || !decoded.shopperId) {
      return res.status(401).json({ message: "Invalid shopper token" });
    }
    req.shopper = { id: decoded.shopperId, email: decoded.email };
    return next();
  } catch (_err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Optional shopper context — used by /api/public/orders when a shopper happens
// to be signed in. Never throws; just attaches `req.shopper` if a valid token
// is present.
export async function attachOptionalShopper(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return next();
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.type === "shopper" && decoded.shopperId) {
      req.shopper = { id: decoded.shopperId, email: decoded.email };
    }
  } catch (_err) {
    // ignore — public order placement is fine for guests
  }
  return next();
}

function toPublicShopper(row) {
  if (!row) return null;
  return {
    id:             row.id,
    email:          row.email,
    name:           row.name,
    picture_url:    row.picture_url,
    phone:          row.phone,
    address:        row.address,
    city:           row.city,
    district:       row.district,
    has_password:   Boolean(row.password_hash),
    has_google:     Boolean(row.google_sub),
    email_verified: Boolean(row.email_verified),
    created_at:     row.created_at
  };
}

async function findShopperById(id) {
  const result = await query(
    "SELECT * FROM shoppers WHERE id = $1 LIMIT 1",
    [id]
  );
  return result.rows[0] || null;
}

async function verifyGoogleIdToken(idToken) {
  if (!idToken) {
    throw createHttpError(400, "Google id_token is required");
  }

  const expectedAudience = process.env.GOOGLE_CLIENT_ID;
  if (!expectedAudience) {
    throw createHttpError(
      500,
      "GOOGLE_CLIENT_ID is not configured on the server"
    );
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );

  if (!response.ok) {
    throw createHttpError(401, "Google rejected this sign-in token");
  }

  const claims = await response.json();

  if (claims.aud !== expectedAudience) {
    throw createHttpError(401, "Google token audience mismatch");
  }

  const emailVerified =
    claims.email_verified === true || claims.email_verified === "true";
  if (!emailVerified) {
    throw createHttpError(401, "Google email is not verified");
  }

  return claims;
}

router.post(
  "/auth/google",
  asyncHandler(async (req, res) => {
    const claims = await verifyGoogleIdToken(req.body.id_token);
    const email = normalizeEmail(claims.email);
    const googleSub = String(claims.sub);
    const name = String(claims.name || "").trim() || null;
    const pictureUrl = String(claims.picture || "").trim() || null;

    // Match by google_sub first, then fall back to email so we can attach
    // Google login to an existing email/password account.
    let result = await query(
      "SELECT * FROM shoppers WHERE google_sub = $1 LIMIT 1",
      [googleSub]
    );

    if (result.rowCount === 0) {
      result = await query(
        "SELECT * FROM shoppers WHERE LOWER(email) = $1 LIMIT 1",
        [email]
      );
    }

    let shopper;
    if (result.rowCount === 0) {
      const insert = await query(
        `INSERT INTO shoppers (email, name, picture_url, google_sub, email_verified)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING *`,
        [email, name, pictureUrl, googleSub]
      );
      shopper = insert.rows[0];
    } else {
      const existing = result.rows[0];
      const update = await query(
        `UPDATE shoppers
           SET google_sub = $1,
               name = COALESCE($2, name),
               picture_url = COALESCE($3, picture_url),
               email_verified = TRUE
         WHERE id = $4
         RETURNING *`,
        [googleSub, name, pictureUrl, existing.id]
      );
      shopper = update.rows[0];
    }

    return res.status(200).json({
      token: signShopperToken(shopper),
      shopper: toPublicShopper(shopper)
    });
  })
);

router.post(
  "/auth/register",
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const name = String(req.body.name || "").trim() || null;

    const errors = [];
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Valid email is required");
    }
    if (password.length < 8) {
      errors.push("Password must be at least 8 characters");
    }
    if (errors.length > 0) {
      return res.status(400).json({ message: "Validation failed", errors });
    }

    const existing = await query(
      "SELECT id FROM shoppers WHERE LOWER(email) = $1 LIMIT 1",
      [email]
    );
    if (existing.rowCount > 0) {
      return res.status(409).json({
        message: "An account with that email already exists. Try signing in."
      });
    }

    const passwordHash = await bcrypt.hash(password, saltRounds);
    const insert = await query(
      `INSERT INTO shoppers (email, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [email, name, passwordHash]
    );
    const shopper = insert.rows[0];

    // storeSlug may be passed so the verify link lands on the right storefront.
    const storeSlug = String(req.body.store_slug || "").trim();
    dispatchShopperVerification(shopper.id, shopper.email, storeSlug).catch(() => {});

    return res.status(201).json({
      token: signShopperToken(shopper),
      shopper: toPublicShopper(shopper)
    });
  })
);

router.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const result = await query(
      "SELECT * FROM shoppers WHERE LOWER(email) = $1 LIMIT 1",
      [email]
    );
    if (result.rowCount === 0 || !result.rows[0].password_hash) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const shopper = result.rows[0];
    const matches = await bcrypt.compare(password, shopper.password_hash);
    if (!matches) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    return res.status(200).json({
      token: signShopperToken(shopper),
      shopper: toPublicShopper(shopper)
    });
  })
);

router.get(
  "/me",
  requireShopper,
  asyncHandler(async (req, res) => {
    const shopper = await findShopperById(req.shopper.id);
    if (!shopper) {
      return res.status(404).json({ message: "Shopper was not found" });
    }
    return res.status(200).json({ shopper: toPublicShopper(shopper) });
  })
);

router.put(
  "/me",
  requireShopper,
  asyncHandler(async (req, res) => {
    const trim = (value, max) =>
      value === undefined
        ? undefined
        : String(value || "").trim().slice(0, max) || null;

    const name = trim(req.body.name, 140);
    const phone = trim(req.body.phone, 30);
    const address = trim(req.body.address, 500);
    const city = trim(req.body.city, 120);
    const district = trim(req.body.district, 120);

    const result = await query(
      `UPDATE shoppers
         SET name = COALESCE($1, name),
             phone = COALESCE($2, phone),
             address = COALESCE($3, address),
             city = COALESCE($4, city),
             district = COALESCE($5, district)
       WHERE id = $6
       RETURNING *`,
      [name, phone, address, city, district, req.shopper.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Shopper was not found" });
    }

    return res.status(200).json({ shopper: toPublicShopper(result.rows[0]) });
  })
);

router.get(
  "/me/orders",
  requireShopper,
  asyncHandler(async (req, res) => {
    const params = [req.shopper.id];
    let where = "customers.shopper_id = $1";
    if (req.query.store_slug) {
      params.push(String(req.query.store_slug).trim());
      where += ` AND stores.slug = $${params.length}`;
    }

    const result = await query(
      `SELECT
         orders.id,
         orders.order_number,
         orders.status,
         orders.cod_status,
         orders.payment_method,
         orders.payment_reference,
         orders.total_amount,
         orders.created_at,
         stores.slug AS store_slug,
         stores.name AS store_name
       FROM orders
       INNER JOIN customers ON customers.id = orders.customer_id
       INNER JOIN stores ON stores.id = orders.store_id
       WHERE ${where}
       ORDER BY orders.created_at DESC
       LIMIT 100`,
      params
    );

    return res.status(200).json({ orders: result.rows });
  })
);

// ── Email verification ────────────────────────────────────────────────────────

// GET /api/shoppers/auth/verify-email?token=<raw>
router.get(
  "/auth/verify-email",
  asyncHandler(async (req, res) => {
    const rawToken = String(req.query.token || "").trim();
    if (!rawToken) {
      return res.status(400).json({ message: "Verification token is required" });
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const result = await query(
      `SELECT id FROM shoppers
       WHERE email_verification_token = $1
         AND email_verification_expires > NOW()`,
      [tokenHash]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({
        message: "Verification link is invalid or has expired"
      });
    }

    await query(
      `UPDATE shoppers
         SET email_verified = TRUE,
             email_verification_token = NULL,
             email_verification_expires = NULL
       WHERE id = $1`,
      [result.rows[0].id]
    );

    return res.status(200).json({ message: "Email verified successfully" });
  })
);

// POST /api/shoppers/auth/resend-verification  (requires shopper auth)
router.post(
  "/auth/resend-verification",
  requireShopper,
  asyncHandler(async (req, res) => {
    const shopper = await findShopperById(req.shopper.id);
    if (!shopper) {
      return res.status(404).json({ message: "Shopper not found" });
    }
    if (shopper.email_verified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    const storeSlug = String(req.body.store_slug || "").trim();
    await dispatchShopperVerification(shopper.id, shopper.email, storeSlug);

    return res.status(200).json({
      message: "Verification email sent. Check your inbox."
    });
  })
);

// ── Password reset ────────────────────────────────────────────────────────────

const RESET_EXPIRES_MS = 60 * 60 * 1000; // 1 hour

// POST /api/shoppers/auth/forgot-password
router.post(
  "/auth/forgot-password",
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const result = await query(
      "SELECT id, email FROM shoppers WHERE LOWER(email) = $1 LIMIT 1",
      [email]
    );

    // Always respond 200 — never reveal whether the email exists.
    if (result.rowCount === 0) {
      return res.status(200).json({
        message: "If that email is registered you'll receive a reset link."
      });
    }

    const shopper = result.rows[0];
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + RESET_EXPIRES_MS);

    await query(
      `UPDATE shoppers
         SET password_reset_token = $1, password_reset_expires = $2
       WHERE id = $3`,
      [tokenHash, expiresAt, shopper.id]
    );

    // storeSlug is passed by the client so the reset URL lands on the correct
    // storefront rather than the admin panel.
    const storeSlug = String(req.body.store_slug || "").trim();
    const basePath = storeSlug ? `/store/${storeSlug}` : "";
    const resetUrl = `${config.publicBaseUrl}${basePath}/reset-password?token=${rawToken}`;

    await sendPasswordResetEmail({
      to: shopper.email,
      resetUrl,
      expiresMinutes: 60
    });

    return res.status(200).json({
      message: "If that email is registered you'll receive a reset link."
    });
  })
);

// POST /api/shoppers/auth/reset-password
router.post(
  "/auth/reset-password",
  asyncHandler(async (req, res) => {
    const rawToken = String(req.body.token || "").trim();
    const newPassword = String(req.body.password || "");

    if (!rawToken) {
      return res.status(400).json({ message: "Reset token is required" });
    }
    if (!newPassword || newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const result = await query(
      `SELECT id FROM shoppers
       WHERE password_reset_token = $1
         AND password_reset_expires > NOW()`,
      [tokenHash]
    );

    if (result.rowCount === 0) {
      return res
        .status(400)
        .json({ message: "Reset link is invalid or has expired" });
    }

    const shopperId = result.rows[0].id;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await query(
      `UPDATE shoppers
         SET password_hash = $1,
             password_reset_token = NULL,
             password_reset_expires = NULL
       WHERE id = $2`,
      [passwordHash, shopperId]
    );

    return res.status(200).json({ message: "Password updated successfully" });
  })
);

export default router;
