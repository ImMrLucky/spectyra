/**
 * Embedding Cache Service
 * 
 * Caches embeddings to reduce compute costs for repeated texts.
 * Supports Redis (preferred) or Postgres fallback.
 * 
 * Cache key: sha256(normalized_text + model + provider)
 * TTL: Configurable (default 30 days)
 */

import { config } from "../../config.js";
import { safeLog } from "../../utils/redaction.js";

// Cache interface
interface CacheStore {
  get(key: string): Promise<number[] | null>;
  set(key: string, value: number[], ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

// In-memory cache for fallback
const memoryCache = new Map<string, { value: number[]; expiresAt: number }>();
const MEMORY_CACHE_MAX_SIZE = 10000;

// Redis client (lazy initialized)
let redisClient: any | null = null;
let redisInitialized = false;

// Postgres pool reference
let pgPool: any | null = null;

/**
 * Initialize Redis connection if available
 */
async function initRedis(): Promise<any | null> {
  if (redisInitialized) return redisClient;
  redisInitialized = true;
  
  const redisUrl = config.cache.redisUrl;
  if (!redisUrl) {
    safeLog("info", "Redis not configured, using memory cache for embeddings");
    return null;
  }
  
  try {
    // Dynamic import to avoid requiring redis if not installed
    // Redis is an optional dependency for embedding caching
    // @ts-ignore - redis is an optional dependency
    const redis = await import("redis").catch(() => null);
    if (!redis) {
      safeLog("info", "Redis module not installed, using memory cache for embeddings");
      return null;
    }
    
    redisClient = redis.createClient({ url: redisUrl });
    
    redisClient.on("error", (err: any) => {
      safeLog("error", "Redis client error", { error: err.message });
    });
    
    await redisClient.connect();
    safeLog("info", "Redis connected for embedding cache");
    return redisClient;
  } catch (error: any) {
    safeLog("warn", "Failed to initialize Redis, using memory cache", { error: error.message });
    return null;
  }
}

/**
 * Initialize Postgres pool for cache fallback
 */
async function initPostgres(): Promise<any | null> {
  if (pgPool) return pgPool;
  if (!config.cache.usePostgres) return null;
  
  try {
    const { query } = await import("../storage/db.js");
    
    // Create embedding cache table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS embedding_cache (
        cache_key TEXT PRIMARY KEY,
        embedding JSONB NOT NULL,
        model TEXT NOT NULL,
        provider TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_embedding_cache_expires 
        ON embedding_cache(expires_at);
    `, []);
    
    pgPool = { query };
    safeLog("info", "Postgres embedding cache initialized");
    return pgPool;
  } catch (error: any) {
    safeLog("warn", "Failed to initialize Postgres cache", { error: error.message });
    return null;
  }
}

/**
 * Get embedding from cache
 */
export async function getEmbeddingCache(key: string): Promise<number[] | null> {
  // Try Redis first
  const redis = await initRedis();
  if (redis) {
    try {
      const value = await redis.get(`emb:${key}`);
      if (value) {
        return JSON.parse(value);
      }
    } catch (error: any) {
      safeLog("warn", "Redis get failed", { error: error.message });
    }
  }
  
  // Try Postgres
  const pg = await initPostgres();
  if (pg) {
    try {
      const result = await pg.query(
        `SELECT embedding FROM embedding_cache 
         WHERE cache_key = $1 AND expires_at > now()`,
        [key]
      );
      if (result.rows.length > 0) {
        return result.rows[0].embedding;
      }
    } catch (error: any) {
      safeLog("warn", "Postgres cache get failed", { error: error.message });
    }
  }
  
  // Try memory cache
  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  } else if (cached) {
    memoryCache.delete(key);
  }
  
  return null;
}

/**
 * Set embedding in cache
 */
export async function setEmbeddingCache(
  key: string, 
  value: number[], 
  ttlSeconds?: number
): Promise<void> {
  const ttl = ttlSeconds ?? config.embeddings.cacheTtlDays * 24 * 60 * 60;
  
  // Store in Redis
  const redis = await initRedis();
  if (redis) {
    try {
      await redis.set(`emb:${key}`, JSON.stringify(value), { EX: ttl });
      return; // Success, skip other stores
    } catch (error: any) {
      safeLog("warn", "Redis set failed", { error: error.message });
    }
  }
  
  // Store in Postgres
  const pg = await initPostgres();
  if (pg) {
    try {
      const expiresAt = new Date(Date.now() + ttl * 1000);
      await pg.query(
        `INSERT INTO embedding_cache (cache_key, embedding, model, provider, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (cache_key) DO UPDATE SET
           embedding = EXCLUDED.embedding,
           expires_at = EXCLUDED.expires_at`,
        [key, JSON.stringify(value), config.embeddings.model, "http", expiresAt]
      );
      return; // Success, skip memory
    } catch (error: any) {
      safeLog("warn", "Postgres cache set failed", { error: error.message });
    }
  }
  
  // Fallback to memory cache (with size limit)
  if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
    // Evict oldest entries
    const entries = Array.from(memoryCache.entries());
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const toDelete = entries.slice(0, Math.floor(MEMORY_CACHE_MAX_SIZE * 0.2));
    for (const [k] of toDelete) {
      memoryCache.delete(k);
    }
  }
  
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttl * 1000,
  });
}

/**
 * Delete embedding from cache
 */
export async function deleteEmbeddingCache(key: string): Promise<void> {
  // Delete from all stores
  const redis = await initRedis();
  if (redis) {
    try {
      await redis.del(`emb:${key}`);
    } catch (error: any) {
      safeLog("warn", "Redis delete failed", { error: error.message });
    }
  }
  
  const pg = await initPostgres();
  if (pg) {
    try {
      await pg.query(`DELETE FROM embedding_cache WHERE cache_key = $1`, [key]);
    } catch (error: any) {
      safeLog("warn", "Postgres cache delete failed", { error: error.message });
    }
  }
  
  memoryCache.delete(key);
}

/**
 * Clean up expired cache entries (call periodically)
 */
export async function cleanupExpiredEmbeddings(): Promise<number> {
  let deleted = 0;
  
  // Clean Postgres
  const pg = await initPostgres();
  if (pg) {
    try {
      const result = await pg.query(
        `DELETE FROM embedding_cache WHERE expires_at <= now()`
      );
      deleted += result.rowCount || 0;
    } catch (error: any) {
      safeLog("warn", "Postgres cache cleanup failed", { error: error.message });
    }
  }
  
  // Clean memory cache
  const now = Date.now();
  for (const [key, value] of memoryCache.entries()) {
    if (value.expiresAt <= now) {
      memoryCache.delete(key);
      deleted++;
    }
  }
  
  safeLog("info", "Embedding cache cleanup completed", { deleted });
  return deleted;
}

/**
 * Get cache statistics
 */
export async function getEmbeddingCacheStats(): Promise<{
  memorySize: number;
  redisConnected: boolean;
  postgresEnabled: boolean;
}> {
  const redis = await initRedis();
  
  return {
    memorySize: memoryCache.size,
    redisConnected: redis !== null,
    postgresEnabled: config.cache.usePostgres,
  };
}
