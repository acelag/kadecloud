import rateLimit from "express-rate-limit";

function jsonHandler(message) {
  return (_req, res) => {
    res.status(429).json({ message });
  };
}

// Aggressive limits on credential-bearing endpoints. Keyed on IP, which is
// fine behind Railway/Render/Fly — they all forward the client IP via
// X-Forwarded-For. Make sure to `app.set("trust proxy", 1)` in production.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler("Too many sign-in attempts. Try again in 15 minutes.")
});

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler("Too many sign-up attempts. Try again in an hour.")
});

// Public order creation: bot-scraping or spam attempts.
export const publicOrderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler("Too many orders too fast. Slow down and try again.")
});

// Uploads: cap at one per few seconds.
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler("Too many uploads. Try again in a minute.")
});

// Password reset: allow only a handful of requests per hour per IP to prevent
// email flooding or user enumeration via timing.
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler("Too many password reset requests. Try again in an hour.")
});
