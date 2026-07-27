import express from "express";
import { getClient, query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { getUserStore, requireStoreUser } from "../utils/storeAccess.js";

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

function validateAdjustmentBody(body) {
  const errors = [];
  const productId = body.product_id;
  const adjustmentType = String(body.adjustment_type || "").trim();
  const quantity = Number.parseInt(body.quantity, 10);
  const reason = String(body.reason || "").trim();

  if (!productId) {
    errors.push("Product is required");
  }

  if (!["add", "remove"].includes(adjustmentType)) {
    errors.push("Adjustment type must be add or remove");
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    errors.push("Quantity must be a positive integer");
  }

  if (!reason) {
    errors.push("Reason is required");
  }

  return {
    errors,
    values: {
      product_id: productId,
      adjustment_type: adjustmentType,
      quantity,
      reason,
      note: String(body.note || "").trim() || null
    }
  };
}

router.use(requireAuth, requireStoreUser);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const store = await getUserStore(req.user.id);
    const result = await query(
      `SELECT
        products.id,
        products.name,
        products.sku,
        categories.name AS category,
        products.stock_quantity,
        products.low_stock_threshold,
        products.is_active,
        products.updated_at,
        (products.low_stock_threshold > 0 AND products.stock_quantity <= products.low_stock_threshold) AS is_low_stock
      FROM products
      LEFT JOIN categories ON categories.id = products.category_id
      WHERE products.store_id = $1
      ORDER BY
        (products.low_stock_threshold > 0 AND products.stock_quantity <= products.low_stock_threshold) DESC,
        products.updated_at DESC`,
      [store.id]
    );

    return res.status(200).json({
      inventory: result.rows,
      low_stock: result.rows.filter((product) => product.is_low_stock)
    });
  })
);

router.post(
  "/adjust",
  asyncHandler(async (req, res) => {
    const { errors, values } = validateAdjustmentBody(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors
      });
    }

    const store = await getUserStore(req.user.id);
    const client = await getClient();

    try {
      await client.query("BEGIN");

      const productResult = await client.query(
        `SELECT id, name, stock_quantity
         FROM products
         WHERE id = $1 AND store_id = $2
         FOR UPDATE`,
        [values.product_id, store.id]
      );

      if (productResult.rowCount === 0) {
        throw createHttpError(404, "Product was not found");
      }

      const product = productResult.rows[0];
      const stockBefore = Number(product.stock_quantity);
      const quantityChange =
        values.adjustment_type === "add" ? values.quantity : -values.quantity;
      const stockAfter = stockBefore + quantityChange;

      if (stockAfter < 0) {
        throw createHttpError(400, "Stock cannot be negative");
      }

      const updatedProduct = await client.query(
        `UPDATE products
         SET stock_quantity = $1
         WHERE id = $2
         RETURNING
          id,
          name,
          sku,
          category,
          stock_quantity,
          low_stock_threshold,
          is_active,
          updated_at,
          (low_stock_threshold > 0 AND stock_quantity <= low_stock_threshold) AS is_low_stock`,
        [stockAfter, product.id]
      );

      const logResult = await client.query(
        `INSERT INTO inventory_logs (
          store_id,
          product_id,
          type,
          adjustment_type,
          quantity_change,
          stock_before,
          stock_after,
          reason,
          note,
          created_by
        )
        VALUES (
          $1,
          $2,
          'manual_adjustment',
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9
        )
        RETURNING
          id,
          product_id,
          type,
          adjustment_type,
          quantity_change,
          stock_before,
          stock_after,
          reason,
          note,
          created_by,
          created_at`,
        [
          store.id,
          product.id,
          values.adjustment_type,
          quantityChange,
          stockBefore,
          stockAfter,
          values.reason,
          values.note,
          req.user.id
        ]
      );

      await client.query("COMMIT");

      return res.status(200).json({
        product: updatedProduct.rows[0],
        log: logResult.rows[0]
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

router.get(
  "/logs",
  asyncHandler(async (req, res) => {
    const store = await getUserStore(req.user.id);
    const result = await query(
      `SELECT
        inventory_logs.id,
        inventory_logs.product_id,
        products.name AS product_name,
        products.sku AS product_sku,
        inventory_logs.type,
        inventory_logs.adjustment_type,
        inventory_logs.quantity_change,
        inventory_logs.stock_before,
        inventory_logs.stock_after,
        inventory_logs.reason,
        inventory_logs.note,
        users.name AS created_by_name,
        inventory_logs.created_at
      FROM inventory_logs
      LEFT JOIN products ON products.id = inventory_logs.product_id
      LEFT JOIN users ON users.id = inventory_logs.created_by
      WHERE inventory_logs.store_id = $1
      ORDER BY inventory_logs.created_at DESC`,
      [store.id]
    );

    return res.status(200).json({
      logs: result.rows
    });
  })
);

export default router;
