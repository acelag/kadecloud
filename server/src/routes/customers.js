import express from "express";
import { query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { formatCustomerRisk } from "../utils/customerRisk.js";
import { getUserStore, requireStoreUser } from "../utils/storeAccess.js";

const router = express.Router();

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function normalizeCustomer(customer) {
  return {
    ...customer,
    risk_status: formatCustomerRisk(customer.risk_status)
  };
}

router.use(requireAuth, requireStoreUser);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const store = await getUserStore(req.user.id);
    const result = await query(
      `SELECT
        id,
        name,
        phone,
        address,
        city,
        district,
        risk_status,
        total_orders,
        cancelled_orders,
        created_at,
        updated_at
      FROM customers
      WHERE store_id = $1
      ORDER BY updated_at DESC`,
      [store.id]
    );

    return res.status(200).json({
      customers: result.rows.map(normalizeCustomer)
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const store = await getUserStore(req.user.id);
    const customerResult = await query(
      `SELECT
        id,
        name,
        phone,
        address,
        city,
        district,
        risk_status,
        total_orders,
        cancelled_orders,
        created_at,
        updated_at
      FROM customers
      WHERE store_id = $1 AND id = $2
      LIMIT 1`,
      [store.id, req.params.id]
    );

    if (customerResult.rowCount === 0) {
      return res.status(404).json({
        message: "Customer was not found"
      });
    }

    const ordersResult = await query(
      `SELECT
        id,
        order_number,
        status,
        cod_status,
        total_amount,
        created_at
      FROM orders
      WHERE store_id = $1 AND customer_id = $2
      ORDER BY created_at DESC`,
      [store.id, req.params.id]
    );

    return res.status(200).json({
      customer: normalizeCustomer(customerResult.rows[0]),
      orders: ordersResult.rows
    });
  })
);

export default router;
