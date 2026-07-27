/**
 * PayHere payment gateway utilities.
 *
 * Hash algorithm (from PayHere docs):
 *   merchant_secret_hash = strtoupper( md5(MERCHANT_SECRET) )
 *   hash = strtoupper( md5(merchant_id + order_id + amount + currency + merchant_secret_hash) )
 *
 * IPN verification hash:
 *   hash = strtoupper( md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + merchant_secret_hash) )
 *
 * status_code meanings:
 *   2  = Success
 *   0  = Pending
 *  -1  = Cancelled
 *  -2  = Failed
 *  -3  = Chargedback
 */

import crypto from "crypto";

function md5Upper(str) {
  return crypto.createHash("md5").update(str).digest("hex").toUpperCase();
}

/**
 * Build the hash sent with the checkout form.
 *
 * @param {object} params
 * @param {string} params.merchantId
 * @param {string} params.merchantSecret
 * @param {string} params.orderId      - KadeCloud order_number (e.g. KC-000001)
 * @param {string|number} params.amount - formatted to 2 decimal places
 * @param {string} params.currency     - e.g. "LKR"
 */
export function buildCheckoutHash({ merchantId, merchantSecret, orderId, amount, currency }) {
  const secretHash = md5Upper(merchantSecret);
  const formatted  = Number(amount).toFixed(2);
  return md5Upper(`${merchantId}${orderId}${formatted}${currency}${secretHash}`);
}

/**
 * Verify the hash that PayHere sends to the IPN endpoint.
 *
 * @param {object} params
 * @param {string} params.merchantId
 * @param {string} params.merchantSecret
 * @param {string} params.orderId
 * @param {string} params.payhereAmount  - as received from PayHere
 * @param {string} params.payhereCurrency
 * @param {string|number} params.statusCode
 * @param {string} params.receivedHash   - the md param from PayHere IPN
 * @returns {boolean}
 */
export function verifyIpnHash({
  merchantId,
  merchantSecret,
  orderId,
  payhereAmount,
  payhereCurrency,
  statusCode,
  receivedHash
}) {
  const secretHash = md5Upper(merchantSecret);
  const expected   = md5Upper(
    `${merchantId}${orderId}${payhereAmount}${payhereCurrency}${statusCode}${secretHash}`
  );
  return expected === String(receivedHash || "").toUpperCase();
}

/**
 * Return the PayHere hosted-checkout URL based on the PAYHERE_SANDBOX flag.
 */
export function checkoutUrl() {
  return process.env.PAYHERE_SANDBOX === "true"
    ? "https://sandbox.payhere.lk/pay/checkout"
    : "https://www.payhere.lk/pay/checkout";
}
