import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { DesktopBridgeService } from '../../core/desktop/desktop-bridge.service';
import { DESKTOP_SETUP, friendlyProviderKeyUserMessage } from '../../core/desktop/desktop-setup-messages';

@Component({
  selector: 'app-desktop-onboarding',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
  ],
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss'],
})
export class DesktopOnboardingPage implements OnInit {
  step: 1 | 2 = 1;
  provider = 'openai';
  apiKey = '';
  runMode = 'on';
  telemetryMode = 'local';
  promptSnapshots = 'local_only';
  saving = false;
  error = '';

  constructor(
    private desktop: DesktopBridgeService,
    private router: Router,
  ) {}

  ngOnInit() {
    void this.load();
  }

  chooseUseCase(which: 'sdk' | 'openclaw' | 'server' | 'events'): void {
    localStorage.setItem('spectyra_desktop_use_case', which);
    void this.router.navigateByUrl('/desktop/agent-companion');
  }

  backToStep1(): void {
    this.step = 1;
  }

  skipToProviderConfig(): void {
    this.step = 2;
  }

  private async load() {
    const cfg = await this.desktop.getConfig();
    if (cfg) {
      if (typeof cfg['provider'] === 'string') this.provider = cfg['provider'] as string;
      if (typeof cfg['runMode'] === 'string') this.runMode = cfg['runMode'] as string;
      if (typeof cfg['telemetryMode'] === 'string') this.telemetryMode = cfg['telemetryMode'] as string;
      if (typeof cfg['promptSnapshots'] === 'string') this.promptSnapshots = cfg['promptSnapshots'] as string;
      const keys = cfg['providerKeys'] as Record<string, string> | undefined;
      const k = keys?.[this.provider];
      if (k) this.apiKey = k;
    }
  }

  async save() {
    this.error = '';
    this.saving = true;
    try {
      await this.desktop.saveConfig({
        provider: this.provider,
        runMode: this.runMode,
        telemetryMode: this.telemetryMode,
        promptSnapshots: this.promptSnapshots,
      });
      if (this.apiKey.trim()) {
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
          const pk = await this.desktop.setProviderKey(this.provider, this.apiKey.trim());
          const friendly = friendlyProviderKeyUserMessage(pk);
          if (friendly.success) break;
          if (attempt === 2) {
            this.error = friendly.message ?? DESKTOP_SETUP.providerSaveFailed;
            return;
          }
        }
      }
      localStorage.setItem('spectyra_desktop_onboarding_done', '1');
      await this.router.navigateByUrl('/desktop/live');
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'Save failed';
    } finally {
      this.saving = false;
    }
  }
}
