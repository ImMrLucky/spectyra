/**
 * Cache Store Factory
 * 
 * Creates the appropriate cache store based on environment configuration.
 */

import { CacheStore } from "./cacheStore";
import { MemoryCacheStore } from "./memoryCacheStore";
import { RedisCacheStore } from "./redisCacheStore";

let cacheStoreInstance: CacheStore | null = null;

export function createCacheStore(): CacheStore | null {
  // Return existing instance if already created
  if (cacheStoreInstance) {
    return cacheStoreInstance;
  }

  const driver = process.env.SPECTYRA_CACHE_DRIVER || "memory";
  
  if (driver === "none") {
    return null;
  }

  try {
    if (driver === "redis") {
      cacheStoreInstance = new RedisCacheStore();
    } else {
      // Default to memory cache
      cacheStoreInstance = new MemoryCacheStore();
    }
    
    return cacheStoreInstance;
  } catch (error) {
    console.error("Failed to create cache store, falling back to memory:", error);
    cacheStoreInstance = new MemoryCacheStore();
    return cacheStoreInstance;
  }
}

export function getCacheStore(): CacheStore | null {
  return cacheStoreInstance || createCacheStore();
}
