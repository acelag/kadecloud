import dotenv from "dotenv";

dotenv.config();

const env = process.env;
const isProduction = env.NODE_ENV === "production";
const errors = [];
const warnings = [];

function requireEnv(name, { minLength = 0, banned = [] } = {}) {
  const value = env[name];
  if (!value || value.length < minLength) {
    errors.push(
      `${name} is required${minLength ? ` (min ${minLength} chars)` : ""}`
    );
    return value || "";
  }
  if (banned.some((bad) => value === bad)) {
    errors.push(`${name} is set to a placeholder value — generate a real one`);
  }
  return value;
}

// Always-required.
const DATABASE_URL = requireEnv("DATABASE_URL");
const JWT_SECRET = requireEnv("JWT_SECRET", {
  minLength: isProduction ? 32 : 8,
  banned: ["change-this-to-a-long-random-secret"]
});

// Required in production. In development we warn but allow defaults so the
// repo runs out of the box.
if (isProduction) {
  if (!env.CORS_ORIGINS) {
    errors.push(
      "CORS_ORIGINS is required in production (comma-separated allow-list)"
    );
  }
  if (!env.PUBLIC_BASE_URL) {
    errors.push(
      "PUBLIC_BASE_URL is required in production (e.g. https://shop.example.com)"
    );
  }
  if (!env.PLATFORM_HOSTS) {
    warnings.push(
      "PLATFORM_HOSTS not set; using default localhost list. Set it to your apex domain in production."
    );
  }
}

// Soft warnings everywhere.
if (!env.GOOGLE_CLIENT_ID) {
  warnings.push("GOOGLE_CLIENT_ID not set; shopper Google sign-in is disabled.");
}
if (!env.SENTRY_DSN) {
  warnings.push("SENTRY_DSN not set; error tracking is disabled.");
}
if (!env.SMTP_HOST) {
  warnings.push(
    "SMTP_HOST not set; password-reset emails will be logged to stdout instead of sent."
  );
}
if (!env.PAYHERE_MERCHANT_ID || env.PAYHERE_MERCHANT_ID === "your-merchant-id") {
  warnings.push(
    "PAYHERE_MERCHANT_ID not set; PayHere payments will be unavailable."
  );
}
if (!env.PAYHERE_SECRET || env.PAYHERE_SECRET === "your-merchant-secret") {
  warnings.push(
    "PAYHERE_SECRET not set; PayHere payments will be unavailable."
  );
}

// Storage: when any S3_* var is set, we expect a full set. In production we
// require object storage (local disk dies on redeploy).
const hasAnyS3Config = Boolean(
  env.S3_BUCKET ||
    env.S3_ENDPOINT ||
    env.S3_ACCESS_KEY_ID ||
    env.S3_SECRET_ACCESS_KEY
);
if (hasAnyS3Config) {
  for (const key of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) {
    if (!env[key]) errors.push(`${key} is required when S3 is configured`);
  }
}
if (isProduction && !hasAnyS3Config) {
  // Object storage is required in production because the local disk driver
  // writes to an ephemeral filesystem (wiped on every redeploy/restart).
  // ALLOW_LOCAL_STORAGE=true is an explicit, temporary escape hatch so the
  // server can boot without S3 for early testing — never leave it on once
  // real uploads matter.
  if (env.ALLOW_LOCAL_STORAGE === "true") {
    warnings.push(
      "ALLOW_LOCAL_STORAGE=true — running on LOCAL DISK in production. Uploaded files are EPHEMERAL and lost on every redeploy/restart. Configure S3_* (Cloudflare R2) before real use."
    );
  } else {
    errors.push(
      "Object storage is required in production. Set S3_BUCKET, S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (Cloudflare R2 works). To boot temporarily on ephemeral local disk, set ALLOW_LOCAL_STORAGE=true."
    );
  }
}

if (errors.length > 0) {
  // Use process.stderr directly so this runs before the logger is set up.
  process.stderr.write(
    `\nKadeCloud server failed to start because of bad config:\n` +
      errors.map((e) => `  - ${e}`).join("\n") +
      "\n\n"
  );
  process.exit(1);
}

for (const warning of warnings) {
  process.stderr.write(`KadeCloud config warning: ${warning}\n`);
}

export const config = {
  nodeEnv: env.NODE_ENV || "development",
  isProduction,
  port: Number.parseInt(env.PORT, 10) || 5001,
  databaseUrl: DATABASE_URL,
  databaseSsl: env.DATABASE_SSL === "true",
  jwtSecret: JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN || "7d",
  googleClientId: env.GOOGLE_CLIENT_ID || null,
  publicBaseUrl:
    env.PUBLIC_BASE_URL ||
    env.CLIENT_BASE_URL ||
    "http://localhost:5173",
  platformHosts: (env.PLATFORM_HOSTS || "localhost,127.0.0.1,0.0.0.0")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  corsOrigins: (env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  sentryDsn: env.SENTRY_DSN || null,
  logLevel: env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  smtp: {
    host: env.SMTP_HOST || null,
    port: Number(env.SMTP_PORT) || 587,
    secure: env.SMTP_SECURE === "true",
    user: env.SMTP_USER || null,
    pass: env.SMTP_PASS || null,
    from: env.SMTP_FROM || null
  },
  payhere: {
    merchantId: env.PAYHERE_MERCHANT_ID || null,
    secret: env.PAYHERE_SECRET || null,
    sandbox: env.PAYHERE_SANDBOX !== "false",
    enabled: Boolean(
      env.PAYHERE_MERCHANT_ID &&
      env.PAYHERE_MERCHANT_ID !== "your-merchant-id" &&
      env.PAYHERE_SECRET &&
      env.PAYHERE_SECRET !== "your-merchant-secret"
    )
  },
  storage: hasAnyS3Config
    ? {
        driver: "s3",
        bucket: env.S3_BUCKET,
        endpoint: env.S3_ENDPOINT || null, // null = real AWS S3
        region: env.S3_REGION || "auto",
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        publicBaseUrl: env.S3_PUBLIC_BASE_URL || null,
        forcePathStyle: env.S3_FORCE_PATH_STYLE === "true"
      }
    : { driver: "local" }
};
