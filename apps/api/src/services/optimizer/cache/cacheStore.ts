/**
 * Cache Store Interface
 * 
 * Abstraction for caching optimized responses using semantic cache keys.
 * Supports Redis (production) and in-memory (dev/fallback).
 */

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  clear?(): Promise<void>; // Optional: for testing
}
