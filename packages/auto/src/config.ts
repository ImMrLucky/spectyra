export interface SpectyraAutoStartOptions {
  project?: string;
  environment?: string;
  service?: string;
  /** When `false`, JSONL writer is disabled (buffer + optional console only). */
  jsonlEnabled?: boolean;
  jsonlPath?: string;
  rotateDaily?: boolean;
  maxFileSizeMb?: number;
  /** When `true`, one-line monitor logs after each captured response. */
  console?: boolean;
}

export interface ResolvedAutoConfig {
  project?: string;
  environment?: string;
  service?: string;
  jsonl: {
    enabled: boolean;
    path?: string;
    rotateDaily?: boolean;
    maxFileSizeMb?: number;
  };
  consoleEnabled: boolean;
}

export function resolveAutoConfig(opts: SpectyraAutoStartOptions): ResolvedAutoConfig {
  const jsonlEnabled =
    opts.jsonlEnabled !== undefined
      ? opts.jsonlEnabled
      : process.env.SPECTYRA_JSONL === "false"
        ? false
        : true;

  return {
    project: opts.project ?? process.env.SPECTYRA_PROJECT,
    environment: opts.environment ?? process.env.SPECTYRA_ENV ?? process.env.NODE_ENV,
    service: opts.service ?? process.env.SPECTYRA_SERVICE,
    jsonl: {
      enabled: jsonlEnabled,
      path: opts.jsonlPath ?? process.env.SPECTYRA_JSONL_PATH,
      rotateDaily: opts.rotateDaily !== false,
      maxFileSizeMb: opts.maxFileSizeMb,
    },
    consoleEnabled:
      opts.console !== undefined
        ? Boolean(opts.console)
        : typeof process !== "undefined" && process.env.SPECTYRA_CONSOLE === "true"
          ? true
          : typeof process !== "undefined" && process.env.SPECTYRA_CONSOLE === "false"
            ? false
            : typeof process !== "undefined" && process.env.NODE_ENV !== "production",
  };
}
