const REDACT_PATTERNS: RegExp[] = [
  /\bsk-[a-zA-Z0-9]{10,}\b/g,
  /\bBearer\s+[^\s'"`]+/gi,
  /api_key\s*[:=]\s*['"][^'"]+['"]/gi,
  /Authorization\s*:\s*[^\n]+/gi,
  /['"`][a-zA-Z0-9_-]{20,}['"`]/g,
];

/** Redact likely secrets from a code snippet for UI / terminal display. */
export function redactSnippet(text: string, maxLen = 400): string {
  let s = text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
  for (const re of REDACT_PATTERNS) {
    s = s.replace(re, (m) => (m.toLowerCase().includes("bearer") ? "Bearer [REDACTED]" : "[REDACTED]"));
  }
  return s;
}
