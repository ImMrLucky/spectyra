/**
 * Optional dedupe by event id (same adapter may re-emit).
 */

export function createEventDeduper(windowMs = 60_000) {
  const seen = new Map<string, number>();

  return {
    isDuplicate(id: string): boolean {
      const now = Date.now();
      for (const [k, t] of seen) {
        if (now - t > windowMs) seen.delete(k);
      }
      if (seen.has(id)) return true;
      seen.set(id, now);
      return false;
    },
    clear() {
      seen.clear();
    },
  };
}
