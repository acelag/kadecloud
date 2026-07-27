// Email service — thin wrapper around nodemailer.
//
// Configuration is read from environment variables at call time (not at
// import time) so tests can override them without module caching issues.
//
// If SMTP_HOST is not set the service operates in "log-only" mode: it prints
// the email to stdout instead of sending it.  This keeps local development
// working out-of-the-box with zero SMTP setup.
import nodemailer from "nodemailer";

function buildTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null; // log-only mode

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true", // true = TLS on port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function fromAddress() {
  return (
    process.env.SMTP_FROM ||
    `"KadeCloud" <noreply@${process.env.SMTP_HOST || "kadecloud.app"}>`
  );
}

// Send a plain-text + HTML email.  Returns the nodemailer info object, or
// `null` if running in log-only mode.
export async function sendEmail({ to, subject, text, html }) {
  const transport = buildTransport();

  if (!transport) {
    // Development fallback — log to stdout so devs can grab the link.
    console.log(
      `\n📧  [EMAIL LOG — SMTP not configured]\n` +
        `To:      ${to}\n` +
        `Subject: ${subject}\n` +
        `---\n${text}\n`
    );
    return null;
  }

  return transport.sendMail({
    from: fromAddress(),
    to,
    subject,
    text,
    html
  });
}

// ── Specific email templates ──────────────────────────────────────────────────

export async function sendPasswordResetEmail({ to, resetUrl, expiresMinutes = 60 }) {
  const subject = "Reset your KadeCloud password";

  const text = [
    `Hi,`,
    ``,
    `You requested a password reset for your KadeCloud account.`,
    ``,
    `Click the link below to set a new password. The link expires in ${expiresMinutes} minutes.`,
    ``,
    resetUrl,
    ``,
    `If you didn't request this, you can safely ignore this email — your password won't change.`,
    ``,
    `— The KadeCloud team`
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
        <tr>
          <td style="background:#10b981;padding:24px 32px">
            <p style="margin:0;font-size:18px;font-weight:700;color:#fff">KadeCloud</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a">Reset your password</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6">
              Click the button below to set a new password for your account.
              This link expires in <strong>${expiresMinutes} minutes</strong>.
            </p>
            <a href="${resetUrl}"
               style="display:inline-block;background:#10b981;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:8px">
              Reset password
            </a>
            <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">
              Or copy this URL into your browser:<br>
              <a href="${resetUrl}" style="color:#10b981;word-break:break-all">${resetUrl}</a>
            </p>
            <hr style="margin:28px 0;border:none;border-top:1px solid #e2e8f0">
            <p style="margin:0;font-size:13px;color:#94a3b8">
              If you didn't request a password reset, you can safely ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEmail({ to, subject, text, html });
}

// ── Email verification ────────────────────────────────────────────────────────

export async function sendVerificationEmail({ to, verifyUrl }) {
  const subject = "Verify your KadeCloud email address";

  const text = [
    `Hi,`,
    ``,
    `Thanks for signing up for KadeCloud! Please verify your email address by clicking the link below.`,
    ``,
    `The link expires in 24 hours.`,
    ``,
    verifyUrl,
    ``,
    `If you didn't create a KadeCloud account, you can safely ignore this email.`,
    ``,
    `— The KadeCloud team`
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
        <tr>
          <td style="background:#10b981;padding:24px 32px">
            <p style="margin:0;font-size:18px;font-weight:700;color:#fff">KadeCloud</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a">Verify your email</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6">
              Thanks for signing up! Click the button below to confirm your email address.
              This link expires in <strong>24 hours</strong>.
            </p>
            <a href="${verifyUrl}"
               style="display:inline-block;background:#10b981;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:8px">
              Verify email address
            </a>
            <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">
              Or copy this URL into your browser:<br>
              <a href="${verifyUrl}" style="color:#10b981;word-break:break-all">${verifyUrl}</a>
            </p>
            <hr style="margin:28px 0;border:none;border-top:1px solid #e2e8f0">
            <p style="margin:0;font-size:13px;color:#94a3b8">
              If you didn't create a KadeCloud account, you can safely ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEmail({ to, subject, text, html });
}

// ── Order emails ──────────────────────────────────────────────────────────────

function formatCurrency(amount, currency = "LKR") {
  try {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency,
      minimumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

function itemsTableHtml(items, currency) {
  const rows = items
    .map(
      (item) =>
        `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a">
            ${item.product_name} <span style="color:#94a3b8">&times; ${item.quantity}</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;text-align:right;white-space:nowrap">
            ${formatCurrency(item.line_total, currency)}
          </td>
        </tr>`
    )
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

function itemsText(items, currency) {
  return items
    .map((i) => `  ${i.product_name} x${i.quantity}  —  ${formatCurrency(i.line_total, currency)}`)
    .join("\n");
}

function paymentLabel(method) {
  return method === "bank_transfer" ? "Bank Transfer" : "Cash on Delivery";
}

export async function sendOrderConfirmationEmail({
  to, order, items, store, currency = "LKR", bankDetails = null, trackingUrl = null
}) {
  const subject = `Order confirmed — #${order.order_number}`;

  const bankText = bankDetails
    ? [
        "",
        "──────────────────",
        "BANK TRANSFER DETAILS",
        "──────────────────",
        bankDetails.bank_name           ? `Bank:    ${bankDetails.bank_name}` : null,
        bankDetails.bank_account_name   ? `Name:    ${bankDetails.bank_account_name}` : null,
        bankDetails.bank_account_number ? `Account: ${bankDetails.bank_account_number}` : null,
        bankDetails.bank_branch         ? `Branch:  ${bankDetails.bank_branch}` : null,
        bankDetails.bank_transfer_instructions || null
      ].filter((l) => l !== null).join("\n")
    : "";

  const text = [
    `Hi ${order.customer_name},`,
    "",
    `Thank you for your order from ${store.name}!`,
    "",
    `Order number: ${order.order_number}`,
    `Payment:      ${paymentLabel(order.payment_method)}`,
    "",
    "──────────────────",
    itemsText(items, currency),
    "──────────────────",
    `Total: ${formatCurrency(order.total_amount, currency)}`,
    bankText,
    trackingUrl ? `\nTrack your order: ${trackingUrl}` : "",
    "",
    `Questions? Contact ${store.name}${store.phone ? ` at ${store.phone}` : ""}.`,
    "",
    `— ${store.name} via KadeCloud`
  ].join("\n");

  const bankHtml = bankDetails
    ? `<div style="margin:24px 0;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#475569">Bank Transfer Details</p>
        ${bankDetails.bank_name           ? `<p style="margin:0 0 4px;font-size:14px;color:#0f172a"><strong>Bank:</strong> ${bankDetails.bank_name}</p>` : ""}
        ${bankDetails.bank_account_name   ? `<p style="margin:0 0 4px;font-size:14px;color:#0f172a"><strong>Account name:</strong> ${bankDetails.bank_account_name}</p>` : ""}
        ${bankDetails.bank_account_number ? `<p style="margin:0 0 4px;font-size:14px;color:#0f172a"><strong>Account number:</strong> ${bankDetails.bank_account_number}</p>` : ""}
        ${bankDetails.bank_branch         ? `<p style="margin:0 0 4px;font-size:14px;color:#0f172a"><strong>Branch:</strong> ${bankDetails.bank_branch}</p>` : ""}
        ${bankDetails.bank_transfer_instructions ? `<p style="margin:10px 0 0;font-size:13px;color:#475569">${bankDetails.bank_transfer_instructions}</p>` : ""}
      </div>`
    : "";

  const trackHtml = trackingUrl
    ? `<p style="margin:24px 0 0;text-align:center"><a href="${trackingUrl}" style="display:inline-block;background:#10b981;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px">Track my order</a></p>`
    : "";

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="100%" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
  <tr><td style="background:#10b981;padding:20px 32px">
    <p style="margin:0;font-size:18px;font-weight:700;color:#fff">${store.name}</p>
    <p style="margin:4px 0 0;font-size:13px;color:#d1fae5">Powered by KadeCloud</p>
  </td></tr>
  <tr><td style="padding:28px 32px 0">
    <h1 style="margin:0 0 6px;font-size:22px;color:#0f172a">Order confirmed! &#x1F389;</h1>
    <p style="margin:0;font-size:15px;color:#475569">Hi <strong>${order.customer_name}</strong>, thanks for shopping with us.</p>
  </td></tr>
  <tr><td style="padding:20px 32px">
    <div style="background:#f8fafc;border-radius:8px;padding:14px 18px">
      <p style="margin:0;font-size:13px;color:#64748b">Order number</p>
      <p style="margin:4px 0 0;font-size:20px;font-weight:800;color:#0f172a;letter-spacing:.04em">${order.order_number}</p>
    </div>
    <p style="margin:20px 0 10px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#475569">What you ordered</p>
    ${itemsTableHtml(items, currency)}
    <p style="margin:16px 0 0;text-align:right;font-size:16px;font-weight:800;color:#0f172a">Total: ${formatCurrency(order.total_amount, currency)}</p>
    <p style="margin:8px 0 0;text-align:right;font-size:13px;color:#64748b">${paymentLabel(order.payment_method)}</p>
    ${bankHtml}${trackHtml}
  </td></tr>
  <tr><td style="padding:0 32px 28px">
    <hr style="margin:0 0 20px;border:none;border-top:1px solid #e2e8f0">
    <p style="margin:0;font-size:13px;color:#94a3b8">Questions? Contact ${store.name}${store.phone ? ` at <a href="tel:${store.phone}" style="color:#10b981">${store.phone}</a>` : ""}.</p>
  </td></tr>
</table></td></tr></table></body></html>`;

  return sendEmail({ to, subject, text, html });
}

export async function sendNewOrderAlertEmail({
  to, order, items, store, currency = "LKR", adminUrl = null
}) {
  const subject = `New order #${order.order_number} — ${store.name}`;

  const text = [
    `New order on ${store.name}!`,
    "",
    `Order:    #${order.order_number}`,
    `Customer: ${order.customer_name}`,
    `Phone:    ${order.customer_phone}`,
    order.customer_email ? `Email:    ${order.customer_email}` : null,
    `Payment:  ${paymentLabel(order.payment_method)}`,
    "",
    itemsText(items, currency),
    "",
    `Total: ${formatCurrency(order.total_amount, currency)}`,
    adminUrl ? `\nView order: ${adminUrl}` : "",
    "",
    "— KadeCloud"
  ].filter((l) => l !== null).join("\n");

  const adminHtml = adminUrl
    ? `<p style="margin:20px 0 0"><a href="${adminUrl}" style="display:inline-block;background:#0f172a;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:8px">View order &#x2192;</a></p>`
    : "";

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="100%" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
  <tr><td style="background:#0f172a;padding:20px 32px">
    <p style="margin:0;font-size:18px;font-weight:700;color:#fff">${store.name}</p>
    <p style="margin:4px 0 0;font-size:13px;color:#94a3b8">KadeCloud &#x2014; New Order Alert</p>
  </td></tr>
  <tr><td style="padding:28px 32px 0">
    <h1 style="margin:0 0 4px;font-size:22px;color:#0f172a">New order &#x1F6CD;</h1>
    <p style="margin:0;font-size:15px;color:#475569">Order <strong>#${order.order_number}</strong> just came in.</p>
  </td></tr>
  <tr><td style="padding:20px 32px 28px">
    <p style="margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#475569">Customer</p>
    <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#0f172a">${order.customer_name}</p>
    <p style="margin:0 0 4px;font-size:14px;color:#475569">${order.customer_phone}</p>
    ${order.customer_email ? `<p style="margin:0 0 4px;font-size:14px;color:#475569">${order.customer_email}</p>` : ""}
    <p style="margin:0;font-size:14px;color:#475569">${[order.delivery_address, order.delivery_city, order.delivery_district].filter(Boolean).join(", ")}</p>
    <hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0">
    <p style="margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#475569">Items</p>
    ${itemsTableHtml(items, currency)}
    <p style="margin:16px 0 4px;text-align:right;font-size:16px;font-weight:800;color:#0f172a">Total: ${formatCurrency(order.total_amount, currency)}</p>
    <p style="margin:0;text-align:right;font-size:13px;color:#64748b">${paymentLabel(order.payment_method)}</p>
    ${adminHtml}
  </td></tr>
</table></td></tr></table></body></html>`;

  return sendEmail({ to, subject, text, html });
}
