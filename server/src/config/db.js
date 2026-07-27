import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? {
          rejectUnauthorized: false
        }
      : false
});

export async function query(text, params) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  return pool.query(text, params);
}

export async function getClient() {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  return pool.connect();
}

export default pool;
