import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OPENCLAW_CONFIG_JSON } from '@spectyra/integration-metadata';

/** Public docs & registry links (update if ClawHub/OpenClaw URLs change). */
export const OPENCLAW_DOCS_URL = 'https://docs.openclaw.ai';
export const CLAWHUB_DOCS_URL = 'https://docs.openclaw.ai/clawhub';
export const CLAWHUB_HOME_URL = 'https://clawhub.ai';

@Component({
  selector: 'app-openclaw-integration',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './openclaw-integration.page.html',
  styleUrls: ['./openclaw-integration.page.scss', '../integrations/integrations.page.scss'],
})
export class OpenClawIntegrationPage {
  readonly openclawConfigJson = OPENCLAW_CONFIG_JSON;

  readonly openclawDocsUrl = OPENCLAW_DOCS_URL;
  readonly clawhubDocsUrl = CLAWHUB_DOCS_URL;
  readonly clawhubHomeUrl = CLAWHUB_HOME_URL;

  copy(text: string): void {
    void navigator.clipboard.writeText(text);
  }
}
