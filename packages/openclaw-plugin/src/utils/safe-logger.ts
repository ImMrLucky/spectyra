import { redactText } from "./redact.js";

export type SafeLogFields = Record<string, string | number | boolean | undefined | null>;

/**
 * Logs only event kinds, ids, status, error class — never raw prompts or bodies.
 */
export class SafeLogger {
  constructor(private readonly tag = "spectyra-openclaw-plugin") {}

  info(message: string, fields?: SafeLogFields): void {
    this.emit("info", message, fields);
  }

  warn(message: string, fields?: SafeLogFields): void {
    this.emit("warn", message, fields);
  }

  error(message: string, err?: unknown, fields?: SafeLogFields): void {
    const errName = err instanceof Error ? err.name : typeof err;
    this.emit("error", message, { ...fields, errorClass: errName });
  }

  private emit(level: string, message: string, fields?: SafeLogFields): void {
    const safeMessage = redactText(message);
    const safeFields = fields
      ? Object.fromEntries(
          Object.entries(fields).map(([k, v]) => [k, v === undefined || v === null ? v : redactText(String(v))]),
        )
      : undefined;
    const line = safeFields ? `${safeMessage} ${JSON.stringify(safeFields)}` : safeMessage;
    const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    sink(`[${this.tag}]`, line);
  }
}
