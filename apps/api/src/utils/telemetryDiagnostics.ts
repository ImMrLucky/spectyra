const MAX_JSON_CHARS = 16_384;

/**
 * Accept a client-supplied diagnostics object for sdk_run_telemetry.diagnostics.
 * Returns null if invalid or oversized (defense in depth; SDK sends bounded payloads).
 */
export function sanitizeTelemetryDiagnostics(raw: unknown): object | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(JSON.stringify(raw));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const s = JSON.stringify(parsed);
  if (s.length > MAX_JSON_CHARS) return null;
  return parsed as object;
}
