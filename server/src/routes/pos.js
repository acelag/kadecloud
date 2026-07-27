import express from "express";
import { getClient, query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { getUserStore, requireStoreUser } from "../utils/storeAccess.js";
import { refreshCustomerRisk } from "../utils/customerRisk.js";

const router = express.Router();

const ALLOWED_PAYMENT_METHODS = ["cash", "card", "bank_transfer"];

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

function formatOrderNumber(sequenceValue) {
  return `KC-${String(sequenceValue).padStart(6, "0")}`;
}

function validateBody(body) {
  const errors = [];
  const items = Array.isArray(body.items) ? body.items : [];
  const cleanedItems = [];

  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const productId = String(raw.product_id || "").trim();
    const quantity = Number.parseInt(raw.quantity, 10);
    if (!productId) continue;
    if (!Number.isInteger(quantity) || quantity <= 0) {
      errors.push(`Quantity for ${productId} must be a positive integer`);
      continue;
    }
    cleanedItems.push({ product_id: productId, quantity });
  }

  if (cleanedItems.length === 0) {
    errors.push("Cart must contain at least one item");
  }

  const paymentMethod = String(body.payment_method || "cash").trim();
  if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    errors.push(
      `Payment method must be one of: ${ALLOWED_PAYMENT_METHODS.join(", ")}`
    );
  }

  const paymentReference =
    String(body.payment_reference || "").trim().slice(0, 120) || null;
  const customerName = String(body.customer_name || "").trim().slice(0, 140);
  const customerPhone = String(body.customer_phone || "").trim().slice(0, 30);
  const notes = String(body.notes || "").trim() || null;

  let cashGiven = null;
  if (body.cash_given !== undefined && body.cash_given !== null && body.cash_given !== "") {
    const parsed = Number(body.cash_given);
    if (!Number.isFinite(parsed) || parsed < 0) {
      errors.push("Cash given must be a non-negative number");
    } else {
      cashGiven = Math.round(parsed * 100) / 100;
    }
  }

  return {
    errors,
    values: {
      items: cleanedItems,
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      notes,
      cash_given: cashGiven
    }
  };
}

router.use(requireAuth, requireStoreUser);

router.post(
  "/orders",
  asyncHandler(async (req, res) => {
    const { errors, values } = validateBody(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ message: "Validation failed", errors });
    }

    const store = await getUserStore(req.user.id);
    const client = await getClient();

    try {
      await client.query("BEGIN");

      // Lock and load every product in one shot, but in a stable order to
      // avoid deadlocks if two cashiers cart the same products simultaneously.
      const productIds = [...new Set(values.items.map((i) => i.product_id))];
      const productResult = await client.query(
        `SELECT id, name, price, discount_price, stock_quantity, is_active
         FROM products
         WHERE store_id = $1 AND id = ANY($2::uuid[])
         ORDER BY id
         FOR UPDATE`,
        [store.id, productIds]
      );

      if (productResult.rowCount !== productIds.length) {
        throw createHttpError(404, "One or more products were not found");
      }

      const productById = new Map(productResult.rows.map((p) => [p.id, p]));

      // Aggregate quantities (cashier may have scanned the same SKU twice).
      const aggregated = new Map();
      for (const item of values.items) {
        const existing = aggregated.get(item.product_id) || 0;
        aggregated.set(item.product_id, existing + item.quantity);
      }

      const lineItems = [];
      let subtotal = 0;

      for (const [productId, quantity] of aggregated.entries()) {
        const product = productById.get(productId);
        if (!product.is_active) {
          throw createHttpError(
            400,
            `${product.name} is no longer available`
          );
        }
        if (Number(product.stock_quantity) < quantity) {
          throw createHttpError(
            400,
            `${product.name}: only ${product.stock_quantity} in stock`
          );
        }
        const unitPrice = Number(product.discount_price || product.price);
        const lineTotal = unitPrice * quantity;
        subtotal += lineTotal;
        lineItems.push({
          product,
          quantity,
          unit_price: unitPrice,
          line_total: lineTotal
        });
      }

      // Customer: optional. Create or update by (store_id, phone) if a phone
      // was provided. Otherwise leave customer_id NULL on the order.
      let customerId = null;
      if (values.customer_phone) {
        const customerResult = await client.query(
          `INSERT INTO customers (store_id, name, phone)
           VALUES ($1, $2, $3)
           ON CONFLICT (store_id, phone)
           DO UPDATE SET
             name = COALESCE(NULLIF(EXCLUDED.name, ''), customers.name)
           RETURNING id`,
          [store.id, values.customer_name || "Walk-in customer", values.customer_phone]
        );
        customerId = customerResult.rows[0].id;
      }

      const sequenceResult = await client.query(
        "SELECT nextval('kadecloud_order_number_seq') AS sequence_value"
      );
      const orderNumber = formatOrderNumber(
        sequenceResult.rows[0].sequence_value
      );

      const cashGiven =
        values.payment_method === "cash" ? values.cash_given : null;

      const orderResult = await client.query(
        `INSERT INTO orders (
          store_id,
          customer_id,
          order_number,
          status,
          cod_status,
          delivery_status,
          payment_method,
          payment_reference,
          channel,
          customer_name,
          customer_phone,
          delivery_address,
          subtotal,
          delivery_fee,
          total_amount,
          notes,
          cash_given,
          confirmed_at,
          stock_reduced_at
        )
        VALUES (
          $1, $2, $3,
          'delivered',
          'phone_confirmed',
          'delivered',
          $4, $5,
          'pos',
          $6, $7, NULL,
          $8, 0, $8,
          $9, $10,
          now(), now()
        )
        RETURNING
          id, order_number, status, cod_status, delivery_status,
          payment_method, payment_reference, channel,
          customer_name, customer_phone,
          subtotal, delivery_fee, total_amount,
          notes, cash_given, created_at`,
        [
          store.id,
          customerId,
          orderNumber,
          values.payment_method,
          values.payment_reference,
          values.customer_name,
          values.customer_phone,
          subtotal,
          values.notes,
          cashGiven
        ]
      );

      const order = orderResult.rows[0];

      // Insert order items, reduce stock, log inventory.
      const itemsOut = [];
      for (const item of lineItems) {
        const itemResult = await client.query(
          `INSERT INTO order_items (
            order_id, product_id, product_name,
            unit_price, quantity, line_total
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, product_id, product_name, unit_price, quantity, line_total`,
          [
            order.id,
            item.product.id,
            item.product.name,
            item.unit_price,
            item.quantity,
            item.line_total
          ]
        );
        itemsOut.push(itemResult.rows[0]);

        const stockBefore = Number(item.product.stock_quantity);
        const stockAfter = stockBefore - item.quantity;

        await client.query(
          `UPDATE products SET stock_quantity = $1 WHERE id = $2`,
          [stockAfter, item.product.id]
        );

        await client.query(
          `INSERT INTO inventory_logs (
            store_id, product_id, order_id, type, adjustment_type,
            quantity_change, stock_before, stock_after, note, created_by
          )
          VALUES ($1, $2, $3, 'order_confirmed', NULL, $4, $5, $6, $7, $8)`,
          [
            store.id,
            item.product.id,
            order.id,
            -item.quantity,
            stockBefore,
            stockAfter,
            `POS sale ${order.order_number}`,
            req.user.id
          ]
        );
      }

      await client.query(
        `INSERT INTO delivery_updates (order_id, status, note, updated_by)
         VALUES ($1, 'delivered', $2, $3)`,
        [order.id, `POS sale (${values.payment_method})`, req.user.id]
      );

      if (customerId) {
        await client.query(
          `UPDATE customers SET total_orders = total_orders + 1 WHERE id = $1`,
          [customerId]
        );
        await refreshCustomerRisk(client, customerId);
      }

      await client.query("COMMIT");

      return res.status(201).json({
        message: "Sale recorded",
        order,
        items: itemsOut
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

export default router;
