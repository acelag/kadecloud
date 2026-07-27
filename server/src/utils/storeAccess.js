import { query } from "../config/db.js";

export const STORE_ACCESS_ROLES = ["store_admin", "seller"];

export function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function requireStoreUser(req, _res, next) {
  if (!STORE_ACCESS_ROLES.includes(req.user.role)) {
    return next(createHttpError(403, "Only store users can access this area"));
  }

  return next();
}

export function requireStoreAdmin(req, _res, next) {
  if (req.user.role !== "store_admin") {
    return next(createHttpError(403, "Only store admins can manage this area"));
  }

  return next();
}

export async function getUserStore(userId) {
  const result = await query(
    `SELECT
      stores.id,
      stores.seller_id,
      stores.name,
      stores.slug,
      stores.meta_catalog_id,
      stores.meta_access_token,
      stores.meta_currency
     FROM users
     LEFT JOIN stores
      ON stores.id = users.store_id OR stores.seller_id = users.id
     WHERE users.id = $1
     LIMIT 1`,
    [userId]
  );

  if (result.rowCount === 0 || !result.rows[0].id) {
    throw createHttpError(404, "User store was not found");
  }

  return result.rows[0];
}
