import bcrypt from "bcrypt";
import crypto from "crypto";
import express from "express";
import { getClient, query } from "../config/db.js";
import { config } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/email.js";
import { signToken } from "../utils/authToken.js";
import { createUniqueStoreSlug } from "../utils/slug.js";

const router = express.Router();
const saltRounds = 12;
const RESET_EXPIRES_MS      = 60 * 60 * 1000;       // 1 hour
const VERIFY_EXPIRES_MS     = 24 * 60 * 60 * 1000;  // 24 hours

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

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validateRegisterBody(body) {
  const errors = [];
  const name         = String(body.name || body.fullName || "").trim();
  const email        = normalizeEmail(body.email);
  const password     = String(body.password || "");
  const businessName = String(body.businessName || "").trim();

  if (!name)         errors.push("Name is required");
  if (!email)        errors.push("Email is required");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Email must be valid");
  if (!password)     errors.push("Password is required");
  else if (password.length < 8) errors.push("Password must be at least 8 characters");
  if (!businessName) errors.push("Business name is required");

  return {
    errors,
    values: {
      name, email, password, businessName,
      businessCategory: String(body.businessCategory || "").trim() || null,
      phone:            String(body.phone            || "").trim() || null,
      whatsappPhone:    String(body.whatsappPhone    || "").trim() || null,
      address:          String(body.address          || "").trim() || null,
      city:             String(body.city             || "").trim() || null,
      district:         String(body.district         || "").trim() || null
    }
  };
}

function validateLoginBody(body) {
  const errors = [];
  const email    = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (!email)    errors.push("Email is required");
  if (!password) errors.push("Password is required");
  return { errors, values: { email, password } };
}

function toAuthResponse(user, store, token) {
  return {
    token,
    user: {
      id:             user.id,
      name:           user.name,
      email:          user.email,
      role:           user.role,
      email_verified: Boolean(user.email_verified),
      store
    }
  };
}

// Generate a raw token, store its SHA-256 hash, return the raw token for the URL.
function makeToken() {
  const raw  = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

// Send the verification email for a user (fire-and-forget — don't block the
// registration response if email is slow or misconfigured).
async function dispatchVerificationEmail(userId, email) {
  const { raw, hash } = makeToken();
  const expiresAt     = new Date(Date.now() + VERIFY_EXPIRES_MS);

  await query(
    `UPDATE users
       SET email_verification_token = $1, email_verification_expires = $2
     WHERE id = $3`,
    [hash, expiresAt, userId]
  );

  const verifyUrl = `${config.publicBaseUrl}/verify-email?token=${raw}`;
  sendVerificationEmail({ to: email, verifyUrl }).catch(() => {});
}

// ── Register ──────────────────────────────────────────────────────────────────

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { errors, values } = validateRegisterBody(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ message: "Validation failed", errors });
    }

    const existingUser = await query(
      "SELECT id FROM users WHERE email = $1",
      [values.email]
    );
    if (existingUser.rowCount > 0) {
      return res.status(409).json({ message: "A user with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(values.password, saltRounds);
    const client = await getClient();

    try {
      await client.query("BEGIN");

      const userResult = await client.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, 'store_admin')
         RETURNING id, name, email, role, email_verified`,
        [values.name, values.email, passwordHash]
      );
      const user = userResult.rows[0];
      const slug = await createUniqueStoreSlug(client, values.businessName);

      const storeResult = await client.query(
        `INSERT INTO stores (
          seller_id, name, slug, category, phone, whatsapp_phone,
          address, city, district
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id, name, slug, category, phone, whatsapp_phone,
                  address, city, district, logo_url`,
        [
          user.id, values.businessName, slug, values.businessCategory,
          values.phone, values.whatsappPhone, values.address,
          values.city, values.district
        ]
      );
      await client.query(
        "UPDATE users SET store_id = $1 WHERE id = $2",
        [storeResult.rows[0].id, user.id]
      );

      await client.query("COMMIT");

      // Fire verification email after commit — non-blocking.
      dispatchVerificationEmail(user.id, user.email).catch(() => {});

      return res.status(201).json(
        toAuthResponse(user, storeResult.rows[0], signToken(user))
      );
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "23505") {
        throw createHttpError(409, "Email or store slug already exists");
      }
      throw err;
    } finally {
      client.release();
    }
  })
);

// ── Login ─────────────────────────────────────────────────────────────────────

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { errors, values } = validateLoginBody(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ message: "Validation failed", errors });
    }

    const result = await query(
      `SELECT
        users.id, users.name, users.email, users.password_hash,
        users.role, users.is_active, users.email_verified,
        stores.id AS store_id, stores.name AS store_name,
        stores.slug AS store_slug, stores.category AS store_category,
        stores.phone AS store_phone, stores.whatsapp_phone AS store_whatsapp_phone,
        stores.address AS store_address, stores.city AS store_city,
        stores.district AS store_district, stores.logo_url AS store_logo_url,
        stores.favicon_url AS store_favicon_url,
        stores.logo_size AS store_logo_size
      FROM users
      LEFT JOIN stores ON stores.id = users.store_id OR stores.seller_id = users.id
      WHERE users.email = $1`,
      [values.email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ message: "This account is inactive" });
    }

    const passwordMatches = await bcrypt.compare(values.password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const store = user.store_id
      ? {
          id:             user.store_id,
          name:           user.store_name,
          slug:           user.store_slug,
          category:       user.store_category,
          phone:          user.store_phone,
          whatsapp_phone: user.store_whatsapp_phone,
          address:        user.store_address,
          city:           user.store_city,
          district:       user.store_district,
          logo_url:       user.store_logo_url,
          favicon_url:    user.store_favicon_url,
          logo_size:      user.store_logo_size
        }
      : null;

    return res.status(200).json(toAuthResponse(user, store, signToken(user)));
  })
);

// ── Me ────────────────────────────────────────────────────────────────────────

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT
        users.id, users.name, users.email, users.role,
        users.is_active, users.email_verified,
        stores.id AS store_id, stores.name AS store_name,
        stores.slug AS store_slug, stores.category AS store_category,
        stores.phone AS store_phone, stores.whatsapp_phone AS store_whatsapp_phone,
        stores.address AS store_address, stores.city AS store_city,
        stores.district AS store_district, stores.logo_url AS store_logo_url,
        stores.favicon_url AS store_favicon_url,
        stores.logo_size AS store_logo_size
      FROM users
      LEFT JOIN stores ON stores.id = users.store_id OR stores.seller_id = users.id
      WHERE users.id = $1`,
      [req.user.id]
    );

    if (result.rowCount === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ message: "Authenticated user was not found" });
    }

    const user = result.rows[0];
    const store = user.store_id
      ? {
          id:             user.store_id,
          name:           user.store_name,
          slug:           user.store_slug,
          category:       user.store_category,
          phone:          user.store_phone,
          whatsapp_phone: user.store_whatsapp_phone,
          address:        user.store_address,
          city:           user.store_city,
          district:       user.store_district,
          logo_url:       user.store_logo_url,
          favicon_url:    user.store_favicon_url,
          logo_size:      user.store_logo_size
        }
      : null;

    return res.status(200).json({
      user: {
        id:             user.id,
        name:           user.name,
        email:          user.email,
        role:           user.role,
        email_verified: Boolean(user.email_verified),
        store
      }
    });
  })
);

// ── Email verification ────────────────────────────────────────────────────────

// GET /api/auth/verify-email?token=<raw>
router.get(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const rawToken = String(req.query.token || "").trim();
    if (!rawToken) {
      return res.status(400).json({ message: "Verification token is required" });
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const result = await query(
      `SELECT id FROM users
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
      `UPDATE users
         SET email_verified = TRUE,
             email_verification_token = NULL,
             email_verification_expires = NULL
       WHERE id = $1`,
      [result.rows[0].id]
    );

    return res.status(200).json({ message: "Email verified successfully" });
  })
);

// POST /api/auth/resend-verification  (requires auth)
router.post(
  "/resend-verification",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query(
      "SELECT id, email, email_verified FROM users WHERE id = $1",
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    await dispatchVerificationEmail(user.id, user.email);

    return res.status(200).json({
      message: "Verification email sent. Check your inbox."
    });
  })
);

// ── Password reset ────────────────────────────────────────────────────────────

router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const result = await query(
      "SELECT id, name, email FROM users WHERE email = $1 AND is_active = true",
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(200).json({
        message: "If that email is registered you'll receive a reset link."
      });
    }

    const user = result.rows[0];
    const { raw, hash } = makeToken();
    const expiresAt = new Date(Date.now() + RESET_EXPIRES_MS);

    await query(
      `UPDATE users
         SET password_reset_token = $1, password_reset_expires = $2
       WHERE id = $3`,
      [hash, expiresAt, user.id]
    );

    const resetUrl = `${config.publicBaseUrl}/reset-password?token=${raw}`;
    await sendPasswordResetEmail({ to: user.email, resetUrl, expiresMinutes: 60 });

    return res.status(200).json({
      message: "If that email is registered you'll receive a reset link."
    });
  })
);

router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const rawToken   = String(req.body.token    || "").trim();
    const newPassword = String(req.body.password || "");

    if (!rawToken) {
      return res.status(400).json({ message: "Reset token is required" });
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const result = await query(
      `SELECT id FROM users
       WHERE password_reset_token = $1
         AND password_reset_expires > NOW()
         AND is_active = true`,
      [tokenHash]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ message: "Reset link is invalid or has expired" });
    }

    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await query(
      `UPDATE users
         SET password_hash = $1,
             password_reset_token = NULL,
             password_reset_expires = NULL
       WHERE id = $2`,
      [passwordHash, result.rows[0].id]
    );

    return res.status(200).json({ message: "Password updated successfully" });
  })
);

export default router;
