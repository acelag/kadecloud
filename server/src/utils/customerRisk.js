export function formatCustomerRisk(value) {
  return value || "new";
}

export async function calculateCustomerRisk(client, customerId) {
  const result = await client.query(
    `SELECT
      COUNT(*)::int AS total_orders,
      COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered_orders,
      COUNT(*) FILTER (WHERE status IN ('returned', 'rejected'))::int AS rejected_or_returned_orders,
      COUNT(*) FILTER (WHERE cod_status = 'fake_order')::int AS fake_orders
    FROM orders
    WHERE customer_id = $1`,
    [customerId]
  );

  const stats = result.rows[0];

  if (Number(stats.total_orders) === 0) {
    return "new";
  }

  if (Number(stats.fake_orders) > 0) {
    return "high_risk";
  }

  if (Number(stats.rejected_or_returned_orders) >= 2) {
    return "medium_risk";
  }

  if (
    Number(stats.delivered_orders) > 0 &&
    Number(stats.rejected_or_returned_orders) === 0
  ) {
    return "trusted";
  }

  return "new";
}

export async function refreshCustomerRisk(client, customerId) {
  if (!customerId) {
    return null;
  }

  const riskStatus = await calculateCustomerRisk(client, customerId);

  await client.query("UPDATE customers SET risk_status = $1 WHERE id = $2", [
    riskStatus,
    customerId
  ]);

  return riskStatus;
}
