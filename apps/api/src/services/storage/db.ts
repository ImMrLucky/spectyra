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

  // Parse connection string to handle IPv6/IPv4 issues
  // Railway often has issues with IPv6, so prefer connection pooler for Supabase
  let connectionString = databaseUrl;
  
  try {
    const url = new URL(databaseUrl);
    // If using direct Supabase connection (port 5432), prefer connection pooler
    // Connection pooler (port 6543) works much better with Railway and avoids IPv6 issues
    if (url.port === '5432' && (url.hostname.includes('supabase.co') || url.hostname.startsWith('db.'))) {
      // Extract project reference from hostname
      const projectRef = url.hostname.replace('db.', '').replace('.supabase.co', '');
      const password = url.password;
      
      // Use connection pooler - works better with Railway
      // Format: postgresql://postgres.PROJECT_REF:PASSWORD@pooler-host:6543/postgres?pgbouncer=true
      // Note: Try multiple regions - user's pooler might be in different region
      // If DATABASE_URL already contains pooler host, use it; otherwise try common regions
      if (databaseUrl.includes('pooler.supabase.com')) {
        // Already using pooler, use as-is but ensure pgbouncer=true
        connectionString = databaseUrl.includes('pgbouncer=true') 
          ? databaseUrl 
          : databaseUrl + (databaseUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
        console.log("✅ Using existing connection pooler URL");
      } else {
        // Try to detect region from existing URL or use us-east-1 as default
        const regions = ['us-east-1', 'us-west-1', 'eu-west-1'];
        // Default to us-east-1 (most common)
        const region = 'us-east-1';
        connectionString = `postgresql://postgres.${projectRef}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true`;
        console.log("⚠️  Auto-converting to Supabase connection pooler for Railway compatibility");
        console.log(`💡 Using region: ${region}. If this fails, get the exact pooler URL from Supabase Dashboard → Settings → Database → Connection pooling`);
      }
    }
  } catch (e) {
    // If URL parsing fails, use original connection string
    console.warn("Could not parse DATABASE_URL, using as-is");
  }

  pool = new Pool({
    connectionString: connectionString,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Increased timeout for Railway
  });

  // Test connection (non-blocking - let app start even if connection fails initially)
  pool.query("SELECT NOW()")
    .then(() => {
      console.log("✅ Postgres database connected successfully");
    })
    .catch((error: any) => {
      console.error("❌ Failed to connect to Postgres database:", error.message);
      if (error.message.includes('Tenant or user not found')) {
        console.error("\n⚠️  Database authentication error!");
        console.error("💡 This usually means:");
        console.error("   1. Wrong database password in DATABASE_URL");
        console.error("   2. Wrong project reference in connection string");
        console.error("   3. Wrong pooler region (us-east-1 vs us-west-1)");
        console.error("\n💡 Solution: Get the exact connection pooler URL from:");
        console.error("   Supabase Dashboard → Settings → Database → Connection pooling");
        console.error("   Copy the 'Transaction' mode URL and use it in DATABASE_URL\n");
      } else if (error.code === 'ENETUNREACH') {
        console.error("\n⚠️  IPv6 connection issue detected!");
        console.error("💡 Solution: Use Supabase connection pooler URL in DATABASE_URL");
        console.error("   Get it from: Supabase Dashboard → Settings → Database → Connection pooling");
        console.error("   The code auto-converts direct connections, but setting pooler URL directly is recommended.\n");
      }
      // Don't throw - let the app start and retry on first actual query
      console.warn("⚠️  Database connection will be retried on first query");
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
