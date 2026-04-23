import type { SpectyraConfig, SpectyraLogLevel } from "../types.js";

const ORDER: Record<SpectyraLogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

function resolveLogLevel(config: SpectyraConfig): SpectyraLogLevel {
  if (config.logLevel) return config.logLevel;
  if (config.debug) return "info";
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
    return "info";
  }
  return "warn";
}

function should(level: SpectyraLogLevel, at: SpectyraLogLevel): boolean {
  if (at === "silent") return false;
  return ORDER[level] >= ORDER[at];
}

export interface SpectyraLogger {
  readonly logLevel: SpectyraLogLevel;
  log: (category: string, message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
}

/**
 * Small structured logger for the SDK. Categories help filter when tailing dev console.
 */
export function createSpectyraLogger(config: SpectyraConfig): SpectyraLogger {
  const at = resolveLogLevel(config);
  const base = config.logger ?? console;

  return {
    logLevel: at,
    log(category, message, data) {
      if (!should(at, "info")) return;
      if (data) base.log(`[Spectyra:${category}]`, message, data);
      else base.log(`[Spectyra:${category}]`, message);
    },
    warn(message, data) {
      if (!should(at, "warn")) return;
      if (data) base.warn(`[Spectyra]`, message, data);
      else base.warn(`[Spectyra]`, message);
    },
    error(message, data) {
      if (!should(at, "error")) return;
      if (data) base.error(`[Spectyra]`, message, data);
      else base.error(`[Spectyra]`, message);
    },
    debug(message, data) {
      if (!should(at, "debug")) return;
      if (data) (base.debug ?? base.log).call(base, `[Spectyra:debug]`, message, data);
      else (base.debug ?? base.log).call(base, `[Spectyra:debug]`, message);
    },
  };
}
