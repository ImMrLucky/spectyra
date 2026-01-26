/**
 * Redaction Utilities
 * 
 * Removes sensitive data (API keys, provider keys) from objects before logging
 */

const SENSITIVE_PATTERNS = [
  /x-provider-key/gi,
  /x-spectyra-api-key/gi,
  /x-spectyra-key/gi,
  /provider[_-]?key/gi,
  /api[_-]?key/gi,
  /authorization/gi,
  /bearer\s+\S+/gi,
  /sk-[a-z0-9_-]+/gi, // API key patterns
  /sk_ant[_-]?api[0-9]+[_-]?[a-zA-Z0-9_-]+/gi, // Anthropic keys
];

const REDACTION_PLACEHOLDER = "[REDACTED]";

/**
 * Redact sensitive values from an object recursively
 */
export function redactSecrets(obj: any, depth: number = 0): any {
  if (depth > 10) {
    return "[MAX_DEPTH]"; // Prevent infinite recursion
  }
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === "string") {
    // Check if string looks like an API key
    if (obj.length > 20 && /^sk[-_][a-zA-Z0-9_-]+$/.test(obj)) {
      return REDACTION_PLACEHOLDER;
    }
    return obj;
  }
  
  if (typeof obj !== "object") {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactSecrets(item, depth + 1));
  }
  
  const redacted: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key matches sensitive patterns
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
    
    if (isSensitive) {
      redacted[key] = REDACTION_PLACEHOLDER;
    } else if (typeof value === "string" && value.length > 20 && /^sk[-_][a-zA-Z0-9_-]+$/.test(value)) {
      // Value looks like an API key
      redacted[key] = REDACTION_PLACEHOLDER;
    } else {
      redacted[key] = redactSecrets(value, depth + 1);
    }
  }
  
  return redacted;
}

/**
 * Redact headers object
 */
export function redactHeaders(headers: any): any {
  if (!headers || typeof headers !== "object") {
    return headers;
  }
  
  const redacted: any = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    
    if (
      lowerKey.includes("key") ||
      lowerKey.includes("token") ||
      lowerKey.includes("authorization") ||
      lowerKey.includes("provider")
    ) {
      redacted[key] = REDACTION_PLACEHOLDER;
    } else {
      redacted[key] = value;
    }
  }
  
  return redacted;
}

/**
 * Safe logger that automatically redacts secrets
 */
export function safeLog(level: "info" | "warn" | "error", message: string, data?: any): void {
  const redactedData = data ? redactSecrets(data) : undefined;
  
  if (level === "error") {
    console.error(message, redactedData);
  } else if (level === "warn") {
    console.warn(message, redactedData);
  } else {
    console.log(message, redactedData);
  }
}
