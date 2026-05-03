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
  /** Alias for {@link console}. */
  consoleEnabled?: boolean;
  /**
   * When `true`, attempts to mount the floating `<spectyra-overlay>` in browser builds.
   * Backend apps expose overlay data via the dev bridge instead.
   */
  overlayEnabled?: boolean;
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
  overlayEnabled: boolean;
}

export function resolveAutoConfig(opts: SpectyraAutoStartOptions): ResolvedAutoConfig {
  const isNode =
    typeof process !== "undefined" && typeof (process as NodeJS.Process).versions?.node === "string";

  const jsonlEnabled =
    opts.jsonlEnabled !== undefined
      ? opts.jsonlEnabled
      : typeof process !== "undefined" && process.env.SPECTYRA_JSONL === "false"
        ? false
        : isNode;

  const overlayEnabled =
    opts.overlayEnabled !== undefined
      ? opts.overlayEnabled
      : typeof process !== "undefined" && process.env.SPECTYRA_OVERLAY === "true"
        ? true
        : typeof process !== "undefined" && process.env.SPECTYRA_OVERLAY === "1"
          ? true
          : false;

  const consoleOn =
    opts.consoleEnabled !== undefined
      ? Boolean(opts.consoleEnabled)
      : opts.console !== undefined
        ? Boolean(opts.console)
        : typeof process !== "undefined" && process.env.SPECTYRA_CONSOLE === "true"
          ? true
          : typeof process !== "undefined" && process.env.SPECTYRA_CONSOLE === "false"
            ? false
            : typeof process !== "undefined" && process.env.NODE_ENV !== "production";

  return {
    project: opts.project ?? (typeof process !== "undefined" ? process.env.SPECTYRA_PROJECT : undefined),
    environment:
      opts.environment ??
      (typeof process !== "undefined" ? process.env.SPECTYRA_ENV ?? process.env.NODE_ENV : undefined),
    service: opts.service ?? (typeof process !== "undefined" ? process.env.SPECTYRA_SERVICE : undefined),
    jsonl: {
      enabled: jsonlEnabled,
      path: opts.jsonlPath ?? (typeof process !== "undefined" ? process.env.SPECTYRA_JSONL_PATH : undefined),
      rotateDaily: opts.rotateDaily !== false,
      maxFileSizeMb: opts.maxFileSizeMb,
    },
    consoleEnabled: consoleOn,
    overlayEnabled,
  };
}
