import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DesktopBridgeService } from '../../../core/desktop/desktop-bridge.service';

/**
 * Root route (`''`): sends to the setup wizard on first run,
 * otherwise to the OpenClaw home dashboard.
 */
@Component({
  standalone: true,
  template: '',
})
export class OpenClawDesktopRedirect implements OnInit {
  private readonly router = inject(Router);
  private readonly desktop = inject(DesktopBridgeService);

  async ngOnInit(): Promise<void> {
    const setupDone = localStorage.getItem('spectyra_openclaw_setup_done') === '1';
    if (!setupDone) {
      void this.router.navigateByUrl('/desktop/setup', { replaceUrl: true });
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
