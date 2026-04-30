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
  /**
   * When `true` or env `SPECTYRA_CLOUD_SYNC=true`, and a Spectyra **dashboard** API key is set
   * (`SPECTYRA_CLOUD_API_KEY` / `SPECTYRA_API_KEY` or `spectyraCloudApiKey` below), monitor rows are
   * debounced and POSTed to Spectyra Cloud for spectyra.ai dashboards.
   */
  cloudSync?: boolean;
  /** Dashboard / machine API key (`X-SPECTYRA-API-KEY`). Optional if set via env. */
  spectyraCloudApiKey?: string;
  /** Override Spectyra API root (e.g. `https://spectyra.ai/v1`). Optional if set via env. */
  spectyraApiBaseUrl?: string;
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
