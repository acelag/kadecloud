#!/usr/bin/env node
// Seeds the demo accounts the login page advertises. All three share the
// password "Password123" (override with SEED_PASSWORD):
//
//   admin@example.com        platform_admin  (super admin)
//   aselagamlath@gmail.com   store_admin     (owns the "kade Fashion" store)
//   seller@example.com       seller          (staff of kade Fashion)
//
// Idempotent: existing accounts are left as-is (passwords are NOT overwritten),
// so it's safe to re-run. Run AFTER migrations:
//   npm run migrate -w server && npm run seed -w server

import bcrypt from "bcrypt";
import { getClient } from "../config/db.js";

const PASSWORD = process.env.SEED_PASSWORD || "Password123";
const saltRounds = 12;

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, saltRounds);
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // 1. Super admin (no store).
    await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ('Super Admin', 'admin@example.com', $1, 'platform_admin')
       ON CONFLICT (email) DO NOTHING`,
      [passwordHash]
    );

    // 2. Store admin. The email=EXCLUDED.email no-op lets us RETURNING the id
    //    whether the row was inserted or already existed (DO NOTHING wouldn't).
    const adminRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ('Asela Gamlath', 'aselagamlath@gmail.com', $1, 'store_admin')
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [passwordHash]
    );
    const storeAdminId = adminRes.rows[0].id;

    // 3. The store this admin owns ("kade Fashion"). Reuse if it already exists.
    const existingStore = await client.query(
      "SELECT id FROM stores WHERE seller_id = $1 LIMIT 1",
      [storeAdminId]
    );
    let storeId;
    if (existingStore.rowCount > 0) {
      storeId = existingStore.rows[0].id;
    } else {
      const storeRes = await client.query(
        `INSERT INTO stores (seller_id, name, slug, category, city, district)
         VALUES ($1, 'kade Fashion', 'kade-fashion', 'Clothing', 'Colombo', 'Colombo')
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [storeAdminId]
      );
      storeId = storeRes.rows[0].id;
    }
    await client.query("UPDATE users SET store_id = $1 WHERE id = $2", [
      storeId,
      storeAdminId
    ]);

    // 4. Seller attached to the store.
    const sellerRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role, store_id)
       VALUES ('Demo Seller', 'seller@example.com', $1, 'seller', $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [passwordHash, storeId]
    );
    if (sellerRes.rowCount === 0) {
      // Already existed — make sure it's linked to the store.
      await client.query(
        "UPDATE users SET store_id = COALESCE(store_id, $1) WHERE email = 'seller@example.com'",
        [storeId]
      );
    }

    await client.query("COMMIT");

    const shownPassword = process.env.SEED_PASSWORD ? "$SEED_PASSWORD" : PASSWORD;
    console.log(`Seed complete. Demo accounts ready (password: ${shownPassword}):`);
    console.log("  admin@example.com        super admin");
    console.log("  aselagamlath@gmail.com   store admin — kade Fashion");
    console.log("  seller@example.com       seller");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

main().then(() => process.exit(process.exitCode || 0));
