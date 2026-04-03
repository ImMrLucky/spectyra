import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DesktopFirstRunService } from '../../core/desktop/desktop-first-run.service';
import { DesktopBridgeService } from '../../core/desktop/desktop-bridge.service';

/**
 * Default route (`''`): routes to Agent Companion if nothing is set up yet,
 * otherwise to Live.
 *
 * We check both the first-run flag AND whether the companion is actually
 * healthy, because the localStorage flag persists across reinstalls / DMG
 * updates while the companion config may be gone.
 */
@Component({
  standalone: true,
  template: '',
})
export class DesktopHomeRedirectComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly firstRun = inject(DesktopFirstRunService);
  private readonly desktop = inject(DesktopBridgeService);

  async ngOnInit(): Promise<void> {
    if (!this.firstRun.hasAcknowledgedAgentCompanionGuide()) {
      void this.router.navigateByUrl('/desktop/agent-companion', { replaceUrl: true });
      return;
    }

    const setupOk = await this.isCompanionSetUp();
    const target = setupOk ? '/desktop/live' : '/desktop/agent-companion';
    void this.router.navigateByUrl(target, { replaceUrl: true });
  }

  /**
   * Quick probe: companion running + provider key configured.
   * Falls back to Live if we can't determine status within a few seconds.
   */
  private async isCompanionSetUp(): Promise<boolean> {
    try {
      if (
        this.desktop.isElectronRenderer &&
        typeof window !== 'undefined' &&
        window.spectyra?.companion?.getSetupStatus
      ) {
        const ipc = await window.spectyra.companion.getSetupStatus();
        if (!ipc.fetchOk) return false;
        return (
          ipc.statusOk === true &&
          ipc.statusJson?.['providerConfigured'] === true
        );
      }
      const h = await this.desktop.companionHealth();
      return h != null;
    } catch {
      return true;
    }
  }
}
