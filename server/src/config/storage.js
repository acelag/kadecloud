// Storage abstraction: writes either to local disk (dev) or an S3-compatible
// bucket (R2, S3, MinIO). The route layer doesn't care which.
//
// Public API:
//   storage.put(key, buffer, { contentType }) -> { key, url }
//   storage.publicUrl(key, req)               -> url
//   storage.delete(key)                        -> void
//   storage.driverName                         -> "local" | "s3"

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { config } from "./env.js";
import { logger } from "./logger.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_ROOT = path.resolve(here, "../../uploads");

class LocalStorage {
  driverName = "local";

  async put(key, buffer, _options = {}) {
    const full = path.join(LOCAL_ROOT, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, buffer);
    return { key, url: null };
  }

  publicUrl(key, req) {
    const base =
      process.env.PUBLIC_API_BASE_URL ||
      (req ? `${req.protocol}://${req.get("host")}` : "");
    return `${base}/uploads/${key}`;
  }

  async delete(key) {
    try {
      await unlink(path.join(LOCAL_ROOT, key));
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }
}

class S3Storage {
  driverName = "s3";

  constructor(cfg) {
    this.cfg = cfg;
    this.client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint || undefined,
      forcePathStyle: cfg.forcePathStyle,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey
      }
    });
  }

  async put(key, buffer, { contentType } = {}) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType || "application/octet-stream",
        CacheControl: "public, max-age=31536000, immutable"
      })
    );
    return { key, url: this.publicUrl(key) };
  }

  publicUrl(key) {
    if (this.cfg.publicBaseUrl) {
      return `${this.cfg.publicBaseUrl.replace(/\/$/, "")}/${key}`;
    }
    // Fallback for plain AWS S3 (virtual-hosted style).
    return `https://${this.cfg.bucket}.s3.${this.cfg.region}.amazonaws.com/${key}`;
  }

  async delete(key) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key })
    );
  }
}

export const storage =
  config.storage.driver === "s3"
    ? new S3Storage(config.storage)
    : new LocalStorage();

logger.info(
  { driver: storage.driverName },
  `Storage driver ready (${storage.driverName})`
);
