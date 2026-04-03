/** Result of main-process fetch to companion diagnostics (avoid renderer fetch from file://). */
export type CompanionSetupStatusIpc =
  | {
      fetchOk: true;
      statusOk: boolean;
      statusHttp: number;
      statusJson: Record<string, unknown> | null;
      openclawOk: boolean;
      openclawHttp: number;
      openclawJson: { detected?: boolean; connected?: boolean } | null;
    }
  | { fetchOk: false; error: string };

/** Exposed by apps/desktop/electron/preload.ts */
export interface SpectyraPreload {
  companion: {
    start: () => Promise<{ ok: true } | { ok: false; reason: "missing" | "health_timeout" }>;
    stop: () => Promise<boolean>;
    status: () => Promise<{ running: boolean; port?: number }>;
    health: () => Promise<Record<string, unknown> | null>;
    getSetupStatus: () => Promise<CompanionSetupStatusIpc>;
  };
  config: {
    get: () => Promise<Record<string, unknown>>;
    save: (partial: Record<string, unknown>) => Promise<boolean>;
  };
  providerKey: {
    set: (provider: string, key: string) => Promise<boolean>;
    test: (provider: string) => Promise<{ ok: boolean; error?: string; status?: number }>;
  };
  license: {
    activate: (key: string) => Promise<{ ok: boolean; entitlement?: unknown; error?: string }>;
    check: () => Promise<Record<string, unknown>>;
    clear: () => Promise<boolean>;
  };
  openclaw: {
    getExampleConfig: () => Promise<string>;
    detectCli?: () => Promise<{ available: boolean }>;
    runOnboardInTerminal: (opts?: {
      flow?: "quickstart" | "manual";
      mode?: "remote";
      remoteUrl?: string;
    }) => Promise<{ ok: boolean; error?: string }>;
  };
  app: {
    info: () => Promise<Record<string, unknown>>;
    companionBaseUrl: () => Promise<string>;
    openDataDir: () => Promise<void>;
  };
  onStatus: (cb: (status: { running: boolean; port?: number; code?: number }) => void) => void;
}

declare global {
  interface Window {
    spectyra?: SpectyraPreload;
    spectyraDesktop?: { isDesktop: boolean };
  }
}

export {};
