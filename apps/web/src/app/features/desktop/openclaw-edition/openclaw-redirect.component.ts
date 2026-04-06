import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DesktopBridgeService } from '../../../core/desktop/desktop-bridge.service';
import {
  OpenClawDesktopService,
  type OpenClawStatusSnapshot,
} from '../../../core/desktop/openclaw-desktop.service';

/**
 * Root route (`''`): first launch goes to the setup wizard only if OpenClaw does not
 * appear to be installed yet. If the CLI or gateway (e.g. :18789) is already present,
 * we open the home dashboard instead of the "install OpenClaw" flow.
 */
@Component({
  standalone: true,
  template: '',
})
export class OpenClawDesktopRedirect implements OnInit {
  private readonly router = inject(Router);
  private readonly desktop = inject(DesktopBridgeService);
  private readonly openclaw = inject(OpenClawDesktopService);

  async ngOnInit(): Promise<void> {
    let s: OpenClawStatusSnapshot | null = null;
    try {
      s = await this.openclaw.refreshStatus();
    } catch {
      /* ignore */
    }
    const hasOpenClaw = !!s && (s.openclawDetected || s.cliDetected || s.gatewayReachable);

    const setupDone = localStorage.getItem('spectyra_openclaw_setup_done') === '1';
    if (!setupDone) {
      if (hasOpenClaw) {
        localStorage.setItem('spectyra_openclaw_setup_done', '1');
        void this.router.navigateByUrl('/desktop/home', { replaceUrl: true });
        return;
      }
      void this.router.navigateByUrl('/desktop/setup', { replaceUrl: true });
      return;
    }

    /** Companion not configured yet is common; don't send OpenClaw users back to the full install wizard. */
    if (hasOpenClaw) {
      void this.router.navigateByUrl('/desktop/home', { replaceUrl: true });
      return;
    }

    const ok = await this.isHealthy();
    const target = ok ? '/desktop/home' : '/desktop/setup';
    void this.router.navigateByUrl(target, { replaceUrl: true });
  }

  private async isHealthy(): Promise<boolean> {
    try {
      if (
        this.desktop.isElectronRenderer &&
        typeof window !== 'undefined' &&
        window.spectyra?.companion?.getSetupStatus
      ) {
        const ipc = await window.spectyra.companion.getSetupStatus();
        if (!ipc.fetchOk) return false;
        return ipc.statusOk === true && ipc.statusJson?.['providerConfigured'] === true;
      }
      const h = await this.desktop.companionHealth();
      return h != null;
    } catch {
      return true;
    }
  }
}
