/** Max age for "latest" savings to be considered current (companion + plugin). */
export const SEAMLESS_SAVINGS_MAX_AGE_MS = 30_000;

export function isFreshOpenClawTimestamp(iso: string | undefined, maxAgeMs = SEAMLESS_SAVINGS_MAX_AGE_MS): boolean {
  if (!iso) {
    return false;
  }
  const t = Date.parse(iso);
  if (Number.isNaN(t)) {
    return false;
  }
  return Date.now() - t <= maxAgeMs;
}
