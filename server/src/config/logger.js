import pino from "pino";
import { config } from "./env.js";

const baseOptions = {
  level: config.logLevel,
  base: { service: "kadecloud-api" },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.password_hash',
      '*.meta_access_token',
      '*.id_token',
      '*.access_token',
      'req.body.password',
      'req.body.id_token'
    ],
    censor: "[redacted]"
  }
};

// Pretty-print in dev for readable terminal output; JSON in prod for
// log aggregators (Railway, Fly, Logtail, etc.).
const transport = config.isProduction
  ? undefined
  : {
      target: "pino-pretty",
      options: { translateTime: "HH:MM:ss.l", ignore: "pid,hostname,service" }
    };

export const logger = pino({
  ...baseOptions,
  ...(transport ? { transport } : {})
});
