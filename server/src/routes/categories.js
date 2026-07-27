import express from "express";
import { query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import {
  getUserStore,
  requireStoreUser,
  requireStoreAdmin
} from "../utils/storeAccess.js";
import { createSlug } from "../utils/slug.js";

const router = express.Router();

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

function validateBody(body) {
  const errors = [];
  const name = String(body.name || "").trim();
  const position = body.position === undefined ? 0 : Number.parseInt(body.position, 10);

  if (!name) {
    errors.push("Category name is required");
  } else if (name.length > 120) {
    errors.push("Category name must be 120 characters or fewer");
  }

  if (!Number.isInteger(position) || position < 0) {
    errors.push("Position must be a non-negative integer");
  }

  return { errors, values: { name, position } };
}

async function uniqueSlug(storeId, name, excludedId = null) {
  const baseSlug = createSlug(name).slice(0, 130);
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const params = [storeId, slug];
    let sql = "SELECT id FROM categories WHERE store_id = $1 AND slug = $2";

    if (excludedId) {
      params.push(excludedId);
      sql += " AND id <> $3";
    }

    const result = await query(`${sql} LIMIT 1`, params);

    if (result.rowCount === 0) {
      return slug;
    }

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function categoryRow(row) {
  return {
    id: row.id,
    store_id: row.store_id,
    name: row.name,
    slug: row.slug,
    position: row.position,
    product_count: Number(row.product_count || 0),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

router.use(requireAuth, requireStoreUser);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const store = await getUserStore(req.user.id);
    const result = await query(
      `SELECT
        c.id,
        c.store_id,
        c.name,
        c.slug,
        c.position,
        c.created_at,
        c.updated_at,
        COUNT(p.id) FILTER (WHERE p.id IS NOT NULL) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       WHERE c.store_id = $1
       GROUP BY c.id
       ORDER BY c.position ASC, c.name ASC`,
      [store.id]
    );

    res.status(200).json({
      categories: result.rows.map(categoryRow)
    });
  })
);

router.post(
  "/",
  requireStoreAdmin,
  asyncHandler(async (req, res) => {
    const { errors, values } = validateBody(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ message: "Validation failed", errors });
    }

    const store = await getUserStore(req.user.id);
    const slug = await uniqueSlug(store.id, values.name);

    try {
      const result = await query(
        `INSERT INTO categories (store_id, name, slug, position)
         VALUES ($1, $2, $3, $4)
         RETURNING *, 0 AS product_count`,
        [store.id, values.name, slug, values.position]
      );

      res.status(201).json({ category: categoryRow(result.rows[0]) });
    } catch (err) {
      if (err.code === "23505") {
        throw createHttpError(409, "A category with this name already exists");
      }

      throw err;
    }
  })
);

router.put(
  "/:id",
  requireStoreAdmin,
  asyncHandler(async (req, res) => {
    const { errors, values } = validateBody(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ message: "Validation failed", errors });
    }

    const store = await getUserStore(req.user.id);
    const existing = await query(
      "SELECT id FROM categories WHERE store_id = $1 AND id = $2 LIMIT 1",
      [store.id, req.params.id]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Category was not found" });
    }

    const slug = await uniqueSlug(store.id, values.name, req.params.id);

    try {
      const result = await query(
        `UPDATE categories
         SET name = $1, slug = $2, position = $3
         WHERE store_id = $4 AND id = $5
         RETURNING *,
           (SELECT COUNT(*) FROM products WHERE category_id = categories.id) AS product_count`,
        [values.name, slug, values.position, store.id, req.params.id]
      );

      res.status(200).json({ category: categoryRow(result.rows[0]) });
    } catch (err) {
      if (err.code === "23505") {
        throw createHttpError(409, "A category with this name already exists");
      }

      throw err;
    }
  })
);

router.delete(
  "/:id",
  requireStoreAdmin,
  asyncHandler(async (req, res) => {
    const store = await getUserStore(req.user.id);
    const result = await query(
      "DELETE FROM categories WHERE store_id = $1 AND id = $2 RETURNING id",
      [store.id, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Category was not found" });
    }

    res.status(200).json({ message: "Category deleted" });
  })
);

export default router;
