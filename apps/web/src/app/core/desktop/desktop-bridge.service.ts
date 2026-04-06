import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { ProviderKeySetResult, ProviderSetActiveResult, SpectyraPreload } from '../../../spectyra-window';

export interface DetectionResult {
  detected: boolean;
  path?: string;
  detail?: string;
}

export interface CompanionStatus {
  running: boolean;
  port?: number;
  code?: number;
}

@Injectable({ providedIn: 'root' })
export class DesktopBridgeService {
  private get api(): SpectyraPreload | undefined {
    return typeof window !== 'undefined' ? window.spectyra : undefined;
  }

  get isElectronRenderer(): boolean {
    return environment.isDesktop && !!this.api;
  }

  async getConfig(): Promise<Record<string, unknown> | null> {
    if (!this.api) return null;
    return this.api.config.get();
  }

  async saveConfig(partial: Record<string, unknown>): Promise<boolean> {
    if (!this.api) return false;
    return this.api.config.save(partial);
  }

  async companionHealth(): Promise<Record<string, unknown> | null> {
    if (!this.api) return null;
    return this.api.companion.health();
  }

  async openClawExample(): Promise<string> {
    if (!this.api) return '';
    return this.api.openclaw.getExampleConfig();
  }

  async runOpenClawOnboardInTerminal(opts?: {
    flow?: 'quickstart' | 'manual';
    mode?: 'remote';
    remoteUrl?: string;
  }): Promise<{ ok: boolean; error?: string }> {
    if (!this.api?.openclaw.runOnboardInTerminal) {
      return { ok: false, error: 'Available only in the Spectyra Desktop app.' };
    }
    return this.api.openclaw.runOnboardInTerminal(opts);
  }

  get canInstallInline(): boolean {
    return !!this.api?.openclaw.runInstallInline;
  }

  async runOpenClawInstallInline(): Promise<{ ok: boolean; error?: string }> {
    if (!this.api?.openclaw.runInstallInline) {
      return { ok: false, error: 'Inline install not available.' };
    }
    return this.api.openclaw.runInstallInline();
  }

  onInstallOutput(cb: (data: string) => void): void {
    this.api?.openclaw.onInstallOutput?.(cb);
  }

  removeInstallOutputListeners(): void {
    this.api?.openclaw.removeInstallOutputListeners?.();
  }

  async getAppInfo(): Promise<Record<string, unknown> | null> {
    if (!this.api) return null;
    return this.api.app.info();
  }

  async setProviderKey(provider: string, key: string): Promise<ProviderKeySetResult> {
    if (!this.api) return { ok: false, error: 'Not in desktop app' };
    return this.api.providerKey.set(provider, key);
  }

  async testProviderKey(provider: string) {
    if (!this.api) return { ok: false, error: 'Not in desktop' };
    return this.api.providerKey.test(provider);
  }

  /** Clears saved provider keys on disk and restarts the local companion. */
  async clearProviderKeys(): Promise<boolean> {
    if (!this.api?.providerKey.clear) return false;
    try {
      return await this.api.providerKey.clear();
    } catch {
      return false;
    }
  }

  /** Switch active LLM provider using a key already saved in Desktop or set in the environment. */
  async setActiveProvider(provider: string): Promise<ProviderSetActiveResult> {
    if (!this.api?.providerKey.setActive) {
      return { ok: false, error: 'Available only in the Spectyra Desktop app.' };
    }
    try {
      return await this.api.providerKey.setActive(provider);
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async activateLicense(key: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.api) return { ok: false, error: 'Not in desktop app' };
    try {
      return await this.api.license.activate(key);
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  onCompanionStatus(cb: (s: CompanionStatus) => void): void {
    this.api?.onStatus(cb);
  }

  /** Detect companion reachability via HTTP (works in browser and desktop). */
  async detectCompanion(): Promise<DetectionResult> {
    const origin = environment.companionBaseUrl.replace(/\/$/, '');
    try {
      const r = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        const data = await r.json();
        return { detected: true, path: origin, detail: `Status: ${data?.status}, Mode: ${data?.runMode}` };
      }
      return { detected: false, detail: `HTTP ${r.status}` };
    } catch {
      return { detected: false, detail: `Cannot reach ${origin}` };
    }
  }

  /** Attempt to detect common OpenClaw config paths. */
  async detectOpenClawConfig(): Promise<DetectionResult> {
    try {
      const origin = environment.companionBaseUrl.replace(/\/$/, '');
      const r = await fetch(`${origin}/config`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        return { detected: true, detail: 'Companion config endpoint reachable' };
      }
    } catch { /* no-op */ }
    return { detected: false, detail: 'Run `openclaw config path` to find your config file' };
  }

  /** Validate the companion models endpoint is responding. */
  async validateModels(): Promise<{ ok: boolean; models: string[] }> {
    const origin = environment.companionBaseUrl.replace(/\/$/, '');
    try {
      const r = await fetch(`${origin}/v1/models`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        const data = await r.json();
        const ids = (data?.data || []).map((m: { id: string }) => m.id);
        return { ok: true, models: ids };
      }
    } catch { /* no-op */ }
    return { ok: false, models: [] };
  }

  /** Validate the ingest endpoint is reachable (for attach/observe flows). */
  async validateIngest(): Promise<boolean> {
    const origin = environment.companionBaseUrl.replace(/\/$/, '');
    try {
      const r = await fetch(`${origin}/v1/analytics/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'spectyra.ping', ts: Date.now() }),
        signal: AbortSignal.timeout(3000),
      });
      return r.status !== 502 && r.status !== 503;
    } catch {
      return false;
    }
  }

  /** Get the companion base URL for display. */
  get companionOrigin(): string {
    return environment.companionBaseUrl.replace(/\/$/, '');
  }
}
