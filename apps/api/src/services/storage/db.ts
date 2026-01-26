/**
 * Postgres Database Connection (via Supabase)
 * 
 * Replaces SQLite with Postgres using pg library.
 * Uses connection pooling for performance.
 */

import { Pool, PoolClient } from "pg";
import { config } from "../../config.js";

let pool: Pool | null = null;

/**
 * Initialize database connection pool
 */
export function initDb(): void {
  if (pool) {
    console.log("Database pool already initialized");
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test connection
  pool.query("SELECT NOW()")
    .then(() => {
      console.log("Postgres database connected successfully");
    })
    .catch((error) => {
      console.error("Failed to connect to Postgres database:", error);
      throw error;
    });
}

/**
 * Get database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return pool;
}

/**
 * Execute a query
 * @param sql SQL query string
 * @param params Query parameters
 * @returns Query result
 */
export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return {
    rows: result.rows as T[],
    rowCount: result.rowCount || 0,
  };
}

/**
 * Execute a query and return first row
 * @param sql SQL query string
 * @param params Query parameters
 * @returns First row or null
 */
export async function queryOne<T = any>(
  sql: string,
  params?: any[]
): Promise<T | null> {
  const result = await query<T>(sql, params);
  return result.rows[0] || null;
}

/**
 * Execute a transaction
 * @param fn Function that receives a client and returns a promise
 * @returns Result of the transaction function
 */
export async function tx<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close database connection pool
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("Database pool closed");
  }
}
