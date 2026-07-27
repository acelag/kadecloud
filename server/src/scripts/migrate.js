#!/usr/bin/env node
// Migration runner: applies every .sql file in database/migrations/ in
// alphabetical order, recording what's been applied in schema_migrations.
// Idempotent — re-running is a no-op after everything's applied.
//
// Usage:
//   node src/scripts/migrate.js           # apply pending migrations
//   node src/scripts/migrate.js --status  # show applied / pending list
//   node src/scripts/migrate.js --dry-run # print pending without running

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config/env.js";
import { getClient } from "../config/db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(here, "../../../database/migrations");

const args = new Set(process.argv.slice(2));
const SHOW_STATUS = args.has("--status");
const DRY_RUN = args.has("--dry-run");

async function listMigrationFiles() {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries
    .filter((name) => name.toLowerCase().endsWith(".sql"))
    .sort();
}

async function ensureTrackingTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum TEXT
    )
  `);
}

async function appliedSet(client) {
  const result = await client.query(
    "SELECT filename FROM schema_migrations"
  );
  return new Set(result.rows.map((row) => row.filename));
}

function checksum(text) {
  // Tiny non-crypto hash so we can detect a migration file changing after
  // it was applied (which would be a footgun).
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return hash.toString(16);
}

async function applyMigration(client, filename) {
  const fullPath = path.join(MIGRATIONS_DIR, filename);
  const sql = await readFile(fullPath, "utf8");
  process.stdout.write(`  → applying ${filename}... `);
  const started = Date.now();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)",
      [filename, checksum(sql)]
    );
    await client.query("COMMIT");
    process.stdout.write(`ok (${Date.now() - started}ms)\n`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    process.stdout.write(`FAILED\n`);
    throw err;
  }
}

async function checkExistingChecksums(client, files) {
  const result = await client.query(
    "SELECT filename, checksum FROM schema_migrations"
  );
  const known = new Map(result.rows.map((r) => [r.filename, r.checksum]));
  const mismatches = [];
  for (const file of files) {
    if (!known.has(file)) continue;
    const stored = known.get(file);
    if (!stored) continue; // older rows without checksum — skip
    const fullPath = path.join(MIGRATIONS_DIR, file);
    const actual = checksum(await readFile(fullPath, "utf8"));
    if (stored !== actual) {
      mismatches.push({ file, stored, actual });
    }
  }
  return mismatches;
}

async function main() {
  const files = await listMigrationFiles();
  if (files.length === 0) {
    console.log("No migration files found in", MIGRATIONS_DIR);
    return;
  }

  const client = await getClient();
  try {
    await ensureTrackingTable(client);
    const applied = await appliedSet(client);
    const pending = files.filter((f) => !applied.has(f));
    const mismatches = await checkExistingChecksums(client, files);

    if (mismatches.length > 0) {
      console.error(
        "\nWARNING: migration files changed after being applied:"
      );
      for (const m of mismatches) {
        console.error(
          `  - ${m.file} (stored ${m.stored}, file is ${m.actual})`
        );
      }
      console.error(
        "Fix this by creating a new migration; don't edit applied ones.\n"
      );
    }

    if (SHOW_STATUS) {
      console.log(`Database: ${maskUrl(config.databaseUrl)}`);
      console.log(`Total migrations: ${files.length}`);
      console.log(`Applied: ${files.length - pending.length}`);
      console.log(`Pending: ${pending.length}`);
      console.log("");
      for (const f of files) {
        const marker = applied.has(f) ? "✓" : "•";
        console.log(`  ${marker} ${f}`);
      }
      return;
    }

    if (pending.length === 0) {
      console.log("Database is up to date. Nothing to apply.");
      return;
    }

    console.log(`Applying ${pending.length} migration(s):`);
    if (DRY_RUN) {
      for (const f of pending) console.log(`  • ${f} (dry run, not applied)`);
      return;
    }

    for (const file of pending) {
      // eslint-disable-next-line no-await-in-loop
      await applyMigration(client, file);
    }
    console.log("All migrations applied.");
  } finally {
    client.release();
  }
}

function maskUrl(url) {
  return String(url || "").replace(/:[^:@/]+@/, ":****@");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nMigration failed:", err.message);
    if (err.code) console.error("  code:", err.code);
    if (err.position) console.error("  position:", err.position);
    if (err.hint) console.error("  hint:", err.hint);
    process.exit(1);
  });
