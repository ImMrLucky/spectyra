/**
 * Redis Cache Store
 * 
 * Redis-based cache store for production use.
 * Supports Redis and Upstash Redis.
 */

import { CacheStore } from "./cacheStore";

export class RedisCacheStore implements CacheStore {
  private client: any; // Redis client (type depends on library)
  private connected: boolean = false;

  constructor(redisUrl?: string) {
    // Lazy initialization - only connect when needed
    this.initializeClient(redisUrl);
  }

  private async initializeClient(redisUrl?: string): Promise<void> {
    if (this.connected) return;

    const url = redisUrl || process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
    
    if (!url) {
      throw new Error("Redis URL not provided. Set REDIS_URL or UPSTASH_REDIS_REST_URL environment variable.");
    }

    try {
      // Try to use @upstash/redis if Upstash URL detected (optional dependency)
      if (url.includes("upstash.io") || process.env.UPSTASH_REDIS_REST_TOKEN) {
        // @ts-expect-error - optional dependency, may not be installed
        const { Redis } = await import("@upstash/redis");
        this.client = new Redis({
          url: url,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
      } else {
        // @ts-expect-error - optional dependency, may not be installed
        const Redis = (await import("ioredis")).default;
        this.client = new Redis(url);
      }
      
      this.connected = true;
    } catch (error) {
      console.error("Failed to initialize Redis cache:", error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    await this.initializeClient();
    
    try {
      if (this.client.get) {
        // Standard Redis client
        return await this.client.get(key);
      } else {
        // Upstash Redis
        return await this.client.get(key);
      }
    } catch (error) {
      console.error("Redis cache get error:", error);
      return null; // Fail gracefully
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.initializeClient();
    
    try {
      if (this.client.set) {
        // Standard Redis client
        await this.client.set(key, value, "EX", ttlSeconds);
      } else {
        // Upstash Redis
        await this.client.set(key, value, { ex: ttlSeconds });
      }
    } catch (error) {
      console.error("Redis cache set error:", error);
      // Fail silently - cache is optional
    }
  }

  async clear(): Promise<void> {
    await this.initializeClient();
    
    try {
      if (this.client.flushdb) {
        await this.client.flushdb();
      } else {
        // Upstash doesn't support flushdb easily
        console.warn("Clear not supported for this Redis client");
      }
    } catch (error) {
      console.error("Redis cache clear error:", error);
    }
  }
}
