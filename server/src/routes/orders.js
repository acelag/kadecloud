import express from "express";
import { getClient, query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { formatCustomerRisk, refreshCustomerRisk } from "../utils/customerRisk.js";
import { getUserStore, requireStoreUser } from "../utils/storeAccess.js";

const router = express.Router();

const ORDER_STATUSES = [
  "new",
  "pending_confirmation",
  "confirmed",
  "packed",
  "dispatched",
  "out_for_delivery",
  "delivered",
  "returned",
  "rejected",
  "cancelled"
];

const COD_STATUSES = [
  "not_verified",
  "phone_confirmed",
  "whatsapp_confirmed",
  "no_answer",
  "suspicious",
  "fake_order"
];

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

function orderSelectSql() {
  return `SELECT
    orders.id,
    orders.store_id,
    orders.customer_id,
    orders.order_number,
    orders.status,
    orders.cod_status,
    orders.delivery_status,
    orders.payment_method,
    orders.payment_reference,
    orders.cash_given,
    orders.channel,
    orders.customer_name,
    orders.customer_phone,
    orders.delivery_address,
    orders.delivery_city,
    orders.delivery_district,
    orders.subtotal,
    orders.delivery_fee,
    orders.total_amount,
    orders.notes,
    orders.seller_notes,
    orders.confirmed_at,
    orders.cancelled_at,
    orders.stock_reduced_at,
    orders.created_at,
    orders.updated_at,
    customers.risk_status AS customer_risk_status,
    customers.total_orders AS customer_total_orders,
    customers.cancelled_orders AS customer_cancelled_orders`;
}

function attachRisk(order) {
  return {
    ...order,
    customer_risk: formatCustomerRisk(order.customer_risk_status)
  };
}

function mapDeliveryStatus(orderStatus) {
  if (orderStatus === "delivered") {
    return "delivered";
  }

  if (orderStatus === "returned") {
    return "returned";
  }

  if (orderStatus === "rejected" || orderStatus === "cancelled") {
    return "failed";
  }

  if (orderStatus === "out_for_delivery") {
    return "in_transit";
  }

  if (orderStatus === "dispatched") {
    return "dispatched";
  }

  return "not_dispatched";
}

async function reduceStockForOrder(client, order, userId) {
  const itemsResult = await client.query(
    `SELECT order_items.product_id, order_items.quantity
     FROM order_items
     WHERE order_items.order_id = $1`,
    [order.id]
  );

  for (const item of itemsResult.rows) {
    const productResult = await client.query(
      `SELECT id, stock_quantity
       FROM products
       WHERE id = $1 AND store_id = $2
       FOR UPDATE`,
      [item.product_id, order.store_id]
    );

    if (productResult.rowCount === 0) {
      throw createHttpError(404, "Order product was not found");
    }

    const product = productResult.rows[0];
    const stockBefore = Number(product.stock_quantity);
    const stockAfter = stockBefore - Number(item.quantity);

    if (stockAfter < 0) {
      throw createHttpError(400, "Insufficient stock to confirm this order");
    }

    await client.query("UPDATE products SET stock_quantity = $1 WHERE id = $2", [
      stockAfter,
      item.product_id
    ]);

    await client.query(
      `INSERT INTO inventory_logs (
        store_id,
        product_id,
        order_id,
        type,
        adjustment_type,
        quantity_change,
        stock_before,
        stock_after,
        note,
        created_by
      )
      VALUES ($1, $2, $3, 'order_confirmed', NULL, $4, $5, $6, $7, $8)`,
      [
        order.store_id,
        item.product_id,
        order.id,
        -Number(item.quantity),
        stockBefore,
        stockAfter,
        `Stock reduced for order ${order.order_number}`,
        userId
      ]
    );
  }
}

async function restoreStockForOrder(client, order, userId) {
  const itemsResult = await client.query(
    `SELECT order_items.product_id, order_items.quantity
     FROM order_items
     WHERE order_items.order_id = $1`,
    [order.id]
  );

  for (const item of itemsResult.rows) {
    const productResult = await client.query(
      `SELECT id, stock_quantity
       FROM products
       WHERE id = $1 AND store_id = $2
       FOR UPDATE`,
      [item.product_id, order.store_id]
    );

    if (productResult.rowCount === 0) {
      throw createHttpError(404, "Order product was not found");
    }

    const product = productResult.rows[0];
    const stockBefore = Number(product.stock_quantity);
    const stockAfter = stockBefore + Number(item.quantity);

    await client.query("UPDATE products SET stock_quantity = $1 WHERE id = $2", [
      stockAfter,
      item.product_id
    ]);

    await client.query(
      `INSERT INTO inventory_logs (
        store_id,
        product_id,
        order_id,
        type,
        adjustment_type,
        quantity_change,
        stock_before,
        stock_after,
        note,
        created_by
      )
      VALUES ($1, $2, $3, 'order_cancelled', NULL, $4, $5, $6, $7, $8)`,
      [
        order.store_id,
        item.product_id,
        order.id,
        Number(item.quantity),
        stockBefore,
        stockAfter,
        `Stock restored for cancelled order ${order.order_number}`,
        userId
      ]
    );
  }
}

router.use(requireAuth, requireStoreUser);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const store = await getUserStore(req.user.id);
    const result = await query(
      `${orderSelectSql()},
        COUNT(order_items.id)::int AS item_count
       FROM orders
       LEFT JOIN customers ON customers.id = orders.customer_id
       LEFT JOIN order_items ON order_items.order_id = orders.id
       WHERE orders.store_id = $1
       GROUP BY orders.id, customers.id
       ORDER BY orders.created_at DESC`,
      [store.id]
    );

    return res.status(200).json({
      orders: result.rows.map(attachRisk)
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const store = await getUserStore(req.user.id);
    const orderResult = await query(
      `${orderSelectSql()}
       FROM orders
       LEFT JOIN customers ON customers.id = orders.customer_id
       WHERE orders.store_id = $1 AND orders.id = $2
       LIMIT 1`,
      [store.id, req.params.id]
    );

    if (orderResult.rowCount === 0) {
      return res.status(404).json({
        message: "Order was not found"
      });
    }

    const itemsResult = await query(
      `SELECT
        id,
        product_id,
        product_variant_id,
        product_name,
        variant_name,
        unit_price,
        quantity,
        line_total
      FROM order_items
      WHERE order_id = $1
      ORDER BY created_at ASC`,
      [req.params.id]
    );

    const updatesResult = await query(
      `SELECT id, status, note, updated_by, created_at
       FROM delivery_updates
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [req.params.id]
    );

    return res.status(200).json({
      order: attachRisk(orderResult.rows[0]),
      items: itemsResult.rows,
      timeline: updatesResult.rows
    });
  })
);

router.put(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const nextStatus = String(req.body.status || "").trim();

    if (!ORDER_STATUSES.includes(nextStatus)) {
      return res.status(400).json({
        message: "Invalid order status"
      });
    }

    const store = await getUserStore(req.user.id);
    const client = await getClient();

    try {
      await client.query("BEGIN");

      const orderResult = await client.query(
        `SELECT *
         FROM orders
         WHERE store_id = $1 AND id = $2
         FOR UPDATE`,
        [store.id, req.params.id]
      );

      if (orderResult.rowCount === 0) {
        throw createHttpError(404, "Order was not found");
      }

      const order = orderResult.rows[0];
      const wasCancelled = order.status === "cancelled";

      if (nextStatus === "confirmed" && !order.stock_reduced_at) {
        await reduceStockForOrder(client, order, req.user.id);
      }

      if (nextStatus === "cancelled" && order.stock_reduced_at) {
        await restoreStockForOrder(client, order, req.user.id);
      }

      const updateResult = await client.query(
        `UPDATE orders
         SET
          status = $1::order_status,
          delivery_status = $2::delivery_status,
          confirmed_at = CASE
            WHEN $1::order_status = 'confirmed'::order_status
              AND confirmed_at IS NULL THEN now()
            ELSE confirmed_at
          END,
          cancelled_at = CASE
            WHEN $1::order_status = 'cancelled'::order_status THEN now()
            ELSE cancelled_at
          END,
          stock_reduced_at = CASE
            WHEN $1::order_status = 'confirmed'::order_status
              AND stock_reduced_at IS NULL THEN now()
            WHEN $1::order_status = 'cancelled'::order_status THEN NULL
            ELSE stock_reduced_at
          END
         WHERE id = $3
         RETURNING *`,
        [nextStatus, mapDeliveryStatus(nextStatus), order.id]
      );

      if (order.customer_id && nextStatus !== order.status &&
          (nextStatus === "cancelled" || wasCancelled)) {
        await client.query(
          `UPDATE customers
           SET cancelled_orders = (
             SELECT COUNT(*) FROM orders
             WHERE customer_id = $1 AND status = 'cancelled'
           )
           WHERE id = $1`,
          [order.customer_id]
        );
      }

      if (
        ["delivered", "returned", "rejected", "cancelled"].includes(nextStatus)
      ) {
        await refreshCustomerRisk(client, order.customer_id);
      }

      if (order.status !== nextStatus) {
        await client.query(
          `INSERT INTO delivery_updates (order_id, status, note, updated_by)
           VALUES ($1, $2, $3, $4)`,
          [
            order.id,
            nextStatus,
            req.body.note || `Status changed to ${nextStatus}`,
            req.user.id
          ]
        );
      }

      await client.query("COMMIT");

      return res.status(200).json({
        order: updateResult.rows[0]
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

router.put(
  "/:id/cod-status",
  asyncHandler(async (req, res) => {
    const nextStatus = String(req.body.cod_status || "").trim();

    if (!COD_STATUSES.includes(nextStatus)) {
      return res.status(400).json({
        message: "Invalid COD status"
      });
    }

    const store = await getUserStore(req.user.id);
    const client = await getClient();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE orders
         SET cod_status = $1
         WHERE store_id = $2 AND id = $3
         RETURNING *`,
        [nextStatus, store.id, req.params.id]
      );

      if (result.rowCount === 0) {
        throw createHttpError(404, "Order was not found");
      }

      await refreshCustomerRisk(client, result.rows[0].customer_id);
      await client.query("COMMIT");

      return res.status(200).json({
        order: result.rows[0]
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

router.put(
  "/:id/notes",
  asyncHandler(async (req, res) => {
    const store = await getUserStore(req.user.id);
    const sellerNotes = String(req.body.seller_notes || "").trim() || null;
    const result = await query(
      `UPDATE orders
       SET seller_notes = $1
       WHERE store_id = $2 AND id = $3
       RETURNING *`,
      [sellerNotes, store.id, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Order was not found"
      });
    }

    return res.status(200).json({
      order: result.rows[0]
    });
  })
);

export default router;
