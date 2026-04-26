import type { SecurityFindingCategory, SecurityLevel } from "./security-types.js";

export interface RuleDefinition {
  id: string;
  severity: SecurityLevel;
  category: SecurityFindingCategory;
  re: RegExp;
  summary: string;
}

/** Order matters: first match wins per span (simplified overlap handling in scanner). */
export const SECURITY_RULES: RuleDefinition[] = [
  {
    id: "private_key_block",
    severity: "critical",
    category: "private_key",
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    summary: "Private key material detected",
  },
  {
    id: "openai_live_key",
    severity: "critical",
    category: "api_key",
    re: /\bsk-(?:live|proj)-[a-zA-Z0-9_-]{20,}\b/g,
    summary: "Possible OpenAI-style API key",
  },
  {
    id: "openai_style_key",
    severity: "high",
    category: "api_key",
    re: /\bsk-[a-zA-Z0-9_-]{20,}\b/g,
    summary: "Possible API key (sk-…)",
  },
  {
    id: "aws_access_key",
    severity: "critical",
    category: "cloud_secret",
    re: /\bAKIA[0-9A-Z]{16}\b/g,
    summary: "Possible AWS access key id",
  },
  {
    id: "aws_session_key",
    severity: "high",
    category: "cloud_secret",
    re: /\bASIA[0-9A-Z]{16}\b/g,
    summary: "Possible AWS temporary access key id",
  },
  {
    id: "github_pat",
    severity: "critical",
    category: "cloud_secret",
    re: /\bghp_[a-zA-Z0-9]{36,}\b/g,
    summary: "Possible GitHub personal access token",
  },
  {
    id: "github_oauth",
    severity: "high",
    category: "auth_token",
    re: /\bgho_[a-zA-Z0-9]{20,}\b/g,
    summary: "Possible GitHub OAuth token",
  },
  {
    id: "bearer_token",
    severity: "critical",
    category: "auth_token",
    re: /Bearer\s+[a-zA-Z0-9._~+/=-]{12,}/gi,
    summary: "Bearer token detected",
  },
  {
    id: "jwt",
    severity: "high",
    category: "auth_token",
    re: /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g,
    summary: "Possible JWT",
  },
  {
    id: "env_assignment",
    severity: "medium",
    category: "env_file",
    re: /^\s*[A-Z0-9_]{2,}\s*=\s*.+$/m,
    summary: "Possible .env-style assignment",
  },
  {
    id: "internal_url",
    severity: "medium",
    category: "internal_url",
    re: /\bhttps?:\/\/(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|127\.0\.0\.1|localhost)(?::\d+)?(?:\/[^\s]*)?/gi,
    summary: "Internal / loopback URL",
  },
];
