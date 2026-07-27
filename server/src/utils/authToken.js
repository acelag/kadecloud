import jwt from "jsonwebtoken";

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw createHttpError(500, "JWT_SECRET is not configured");
  }

  return process.env.JWT_SECRET;
}

export function signToken(user, options = {}) {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      impersonatedBy: options.impersonatedBy || null
    },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d"
    }
  );
}
