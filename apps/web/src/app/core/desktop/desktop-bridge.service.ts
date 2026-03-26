import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { SpectyraPreload } from '../../../spectyra-window';

/**
 * Bridge to Electron preload (`window.spectyra`). No-ops in browser builds.
 */
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

  async setProviderKey(provider: string, key: string): Promise<boolean> {
    if (!this.api) return false;
    return this.api.providerKey.set(provider, key);
  }

  async testProviderKey(provider: string) {
    if (!this.api) return { ok: false, error: 'Not in desktop' };
    return this.api.providerKey.test(provider);
  }

  onCompanionStatus(cb: (s: { running: boolean; port?: number; code?: number }) => void): void {
    this.api?.onStatus(cb);
  }
}
