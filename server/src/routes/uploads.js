import crypto from "node:crypto";
import express from "express";
import { storage } from "../config/storage.js";
import { requireAuth } from "../middleware/auth.js";
import { requireStoreUser } from "../utils/storeAccess.js";

const router = express.Router();
const allowedTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};
const maxImageBytes = 5 * 1024 * 1024;

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

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(
    /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i
  );

  if (!match) {
    throw createHttpError(400, "Upload must be a JPG, PNG, or WebP image");
  }

  return {
    contentType: match[1].toLowerCase(),
    base64: match[2]
  };
}

router.use(requireAuth, requireStoreUser);

router.post(
  "/product-image",
  asyncHandler(async (req, res) => {
    const { contentType, base64 } = parseDataUrl(req.body.data_url);
    const extension = allowedTypes[contentType];

    if (!extension) {
      return res.status(400).json({
        message: "Only JPG, PNG, and WebP images are supported"
      });
    }

    const buffer = Buffer.from(base64, "base64");

    if (buffer.length === 0) {
      return res.status(400).json({ message: "Image file is empty" });
    }

    if (buffer.length > maxImageBytes) {
      return res.status(400).json({ message: "Image must be 5MB or smaller" });
    }

    const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const key = `products/${filename}`;

    const result = await storage.put(key, buffer, { contentType });
    const imageUrl = result.url || storage.publicUrl(key, req);

    return res.status(201).json({ image_url: imageUrl });
  })
);

export default router;
