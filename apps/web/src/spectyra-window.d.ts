/** Spectyra-managed assistant profile (stored locally, not a native OpenClaw concept). */
export interface AssistantProfile {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  skills: string[];
  notes: string;
  heartbeatTemplate?: string;
  createdAt: string;
  updatedAt: string;
}

/** Spectyra-managed task/job template (stored locally). */
export interface TaskTemplate {
  id: string;
  name: string;
  type: 'heartbeat' | 'daily' | 'watcher' | 'checklist';
  schedule?: string;
  prompt: string;
  profileId?: string;
  fileContent?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

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

/** Result of saving a provider API key in the desktop app (includes companion verification). */
export type ProviderKeySetResult =
  | { ok: true; providerReady: true }
  | { ok: true; providerReady: false; hint: string }
  | { ok: false; error: string };

/** Switching active provider using an existing saved or env key. */
export type ProviderSetActiveResult = { ok: true } | { ok: false; error: string };

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
    set: (provider: string, key: string) => Promise<ProviderKeySetResult>;
    test: (provider: string) => Promise<{ ok: boolean; error?: string; status?: number }>;
    /** Removes keys from config.json and provider-keys.json; restarts companion. */
    clear: () => Promise<boolean>;
    /** Use saved/env key only; resets default alias models for that provider. */
    setActive: (provider: string) => Promise<ProviderSetActiveResult>;
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
  openclawHub: {
    configPath: () => Promise<{ ok: boolean; path?: string; error?: string }>;
    doctor: () => Promise<{ ok: boolean; output: string }>;
    dashboardCheck: () => Promise<{ reachable: boolean; status?: number }>;
    gatewayCheck: () => Promise<{ reachable: boolean; status?: number }>;
    skillsSearch: (query: string) => Promise<{ ok: boolean; results: Array<{ name: string; description: string; raw: string }>; error?: string }>;
    skillsInstalled: () => Promise<{ ok: boolean; skills: Array<{ name: string; version: string; raw: string }>; error?: string }>;
    skillsInstall: (name: string) => Promise<{ ok: boolean; output?: string; error?: string }>;
    skillsUpdate: () => Promise<{ ok: boolean; output?: string; error?: string }>;
    openPath: (target: string) => Promise<{ ok: boolean }>;
    openConfig: () => Promise<{ ok: boolean; path?: string; error?: string }>;
    openLogs: () => Promise<{ ok: boolean; path?: string; error?: string }>;
    profilesList: () => Promise<AssistantProfile[]>;
    profilesSave: (profiles: AssistantProfile[]) => Promise<boolean>;
    tasksList: () => Promise<TaskTemplate[]>;
    tasksSave: (tasks: TaskTemplate[]) => Promise<boolean>;
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
