import jwt from "jsonwebtoken";

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return process.env.JWT_SECRET;
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication token is required"
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, getJwtSecret());

    req.user = {
      id: decoded.userId,
      role: decoded.role,
      impersonatedBy: decoded.impersonatedBy || null
    };

    return next();
  } catch (err) {
    if (err.message === "JWT_SECRET is not configured") {
      return next(err);
    }

    return res.status(401).json({
      message: "Invalid or expired authentication token"
    });
  }
}
