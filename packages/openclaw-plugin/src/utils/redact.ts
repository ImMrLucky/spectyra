/**
 * Redact sensitive substrings for logs and previews. Does not persist or ship prompts.
 */

const DEFAULT_PATTERNS: RegExp[] = [
  /\bsk-[a-zA-Z0-9_-]{10,}\b/g,
  /\bsk_live_[a-zA-Z0-9]+\b/g,
  /\bsk_test_[a-zA-Z0-9]+\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bASIA[0-9A-Z]{16}\b/g,
  /\bghp_[a-zA-Z0-9]{20,}\b/g,
  /\bgho_[a-zA-Z0-9]{20,}\b/g,
  /\bgithub_pat_[a-zA-Z0-9_]+\b/g,
  /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g,
  /Bearer\s+[a-zA-Z0-9._~+/=-]{8,}/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bpostgresql:\/\/[^\s]+/gi,
  /\bmysql:\/\/[^\s]+/gi,
  /\bmongodb(\+srv)?:\/\/[^\s]+/gi,
];

export function redactText(input: string, extraPatterns: RegExp[] = []): string {
  let out = input;
  for (const re of [...DEFAULT_PATTERNS, ...extraPatterns]) {
    out = out.replace(re, "[REDACTED]");
  }
  return out;
}

/** Short preview for UI: never returns more than maxLen; applies redaction. */
export function redactPreview(input: string, maxLen = 80): string {
  const slice = input.length > maxLen ? `${input.slice(0, maxLen)}…` : input;
  return redactText(slice);
}
