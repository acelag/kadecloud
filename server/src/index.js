// Load env + validate first, before any other imports that read config.
import { config } from "./config/env.js";
import { initSentry, reportError } from "./config/sentry.js";

initSentry();

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pinoHttp from "pino-http";
import { logger } from "./config/logger.js";
import { corsMiddleware, allowedOrigins } from "./config/cors.js";
import {
  authLimiter,
  passwordResetLimiter,
  publicOrderLimiter,
  signupLimiter,
  uploadLimiter
} from "./config/rateLimits.js";
import { query } from "./config/db.js";
import adminRouter from "./routes/admin.js";
import authRouter from "./routes/auth.js";
import categoriesRouter from "./routes/categories.js";
import customersRouter from "./routes/customers.js";
import inventoryRouter from "./routes/inventory.js";
import ordersRouter from "./routes/orders.js";
import posRouter from "./routes/pos.js";
import productsRouter from "./routes/products.js";
import publicRouter from "./routes/public.js";
import shoppersRouter from "./routes/shoppers.js";
import storesRouter from "./routes/stores.js";
import uploadsRouter from "./routes/uploads.js";
import { primeCurrencyRates } from "./utils/currencyRates.js";

const app = express();
const serverDir = path.dirname(fileURLToPath(import.meta.url));

// When running behind Railway/Fly/Render the real client IP arrives in
// X-Forwarded-For. Trust the first hop only, so rate limiting works.
if (config.isProduction) {
  app.set("trust proxy", 1);
}

app.use(
  pinoHttp({
    logger,
    customLogLevel(_req, res, err) {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    }
  })
);

app.use(corsMiddleware);
app.use(express.json({ limit: "8mb" }));
app.use("/uploads", express.static(path.resolve(serverDir, "../uploads")));

app.get("/api/health", async (_req, res) => {
  let dbOk = false;
  try {
    await query("SELECT 1");
    dbOk = true;
  } catch (err) {
    logger.error({ err }, "Health DB check failed");
  }
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    service: "kadecloud-api",
    db: dbOk ? "up" : "down",
    env: config.nodeEnv
  });
});

// Apply rate limiters on the most abused endpoints. Each router stays
// untouched — we just stack a limiter in front when mounting.
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", signupLimiter);
app.use("/api/auth/forgot-password",        passwordResetLimiter);
app.use("/api/auth/reset-password",         passwordResetLimiter);
app.use("/api/auth/resend-verification",    passwordResetLimiter);
app.use("/api/shoppers/auth/login",         authLimiter);
app.use("/api/shoppers/auth/google",        authLimiter);
app.use("/api/shoppers/auth/register",      signupLimiter);
app.use("/api/shoppers/auth/forgot-password",     passwordResetLimiter);
app.use("/api/shoppers/auth/reset-password",      passwordResetLimiter);
app.use("/api/shoppers/auth/resend-verification", passwordResetLimiter);
app.use("/api/public/orders", publicOrderLimiter);
app.use("/api/uploads", uploadLimiter);

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/stores", storesRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/pos", posRouter);
app.use("/api/customers", customersRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/public", publicRouter);
app.use("/api/shoppers", shoppersRouter);
app.use("/api/uploads", uploadsRouter);

app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use((err, req, res, _next) => {
  const isInvalidIdentifier = err.code === "22P02";
  const statusCode = err.statusCode || (isInvalidIdentifier ? 400 : 500);
  const isDatabaseConnectionError = err.code === "ECONNREFUSED";
  const errorMessage = isInvalidIdentifier
    ? "Invalid identifier"
    : err.message ||
      (isDatabaseConnectionError
        ? "Database connection failed. Check DATABASE_URL and make sure PostgreSQL is running."
        : "Unexpected server error");

  if (statusCode >= 500) {
    // pino-http attaches req.log; fall back to module logger if missing.
    const log = req.log || logger;
    log.error({ err }, "Unhandled error");
    reportError(err, {
      method: req.method,
      path: req.originalUrl
    });
  }

  res.status(statusCode).json({
    message: statusCode === 500 ? "Internal server error" : errorMessage,
    error: config.isProduction ? undefined : errorMessage
  });
});

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      env: config.nodeEnv,
      corsOrigins: allowedOrigins,
      platformHosts: config.platformHosts
    },
    "KadeCloud API listening"
  );
  primeCurrencyRates().then((rates) => {
    logger.info(
      { source: rates.source, fetchedAt: rates.fetched_at },
      "FX rates ready"
    );
  });
});

// Graceful shutdown so deploys don't drop in-flight requests.
function shutdown(signal) {
  return () => {
    logger.info({ signal }, "Shutting down");
    server.close((err) => {
      if (err) {
        logger.error({ err }, "Server close error");
        process.exit(1);
      }
      process.exit(0);
    });
    // Hard exit if it takes too long.
    setTimeout(() => {
      logger.warn("Forcing exit after 10s shutdown timeout");
      process.exit(1);
    }, 10_000).unref();
  };
}
process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));
