import * as Sentry from "@sentry/node";
import { config } from "./env.js";
import { logger } from "./logger.js";

let initialized = false;

export function initSentry() {
  if (!config.sentryDsn) return null;
  if (initialized) return Sentry;

  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: config.isProduction ? 0.1 : 0
  });

  initialized = true;
  logger.info("Sentry initialised");
  return Sentry;
}

export function reportError(err, context) {
  if (!initialized) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

export { Sentry };
