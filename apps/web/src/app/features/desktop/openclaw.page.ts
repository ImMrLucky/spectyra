import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { DesktopBridgeService } from '../../core/desktop/desktop-bridge.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-desktop-openclaw',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatExpansionModule],
  templateUrl: './openclaw/openclaw.page.html',
  styles: [
    `
      .oc-wrap {
        max-width: 880px;
        margin: 0 auto;
        padding: 24px 20px 48px;
      }
      .oc-hero h1 {
        margin: 0 0 8px;
        font-size: 1.75rem;
      }
      .oc-lead {
        color: #64748b;
        line-height: 1.55;
        margin-bottom: 20px;
      }
      .oc-acc {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .oc-steps,
      .oc-cmds {
        line-height: 1.65;
        color: #334155;
      }
      .oc-pre {
        background: #0f172a;
        color: #e2e8f0;
        padding: 14px;
        border-radius: 10px;
        overflow: auto;
        font-size: 12px;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .oc-muted {
        color: #64748b;
        font-size: 0.9rem;
      }
      .oc-msg {
        margin-top: 10px;
        color: #0369a1;
      }
      code {
        background: #f1f5f9;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.85em;
      }
    `,
  ],
})
export class DesktopOpenClawPage implements OnInit {
  baseV1 = `${environment.companionBaseUrl}/v1`;
  json = '';
  health: Record<string, unknown> | null = null;
  message = '';

  constructor(private desktop: DesktopBridgeService) {}

  async ngOnInit() {
    this.json = (await this.desktop.openClawExample()) || '';
    await this.refreshHealth();
  }

  async refreshHealth() {
    try {
      const h = await fetch(`${environment.companionBaseUrl}/health`).then((r) => (r.ok ? r.json() : null));
      this.health = h;
    } catch {
      this.health = null;
    }
  }

  async test() {
    this.message = '';
    await this.refreshHealth();
    try {
      const m = await fetch(`${environment.companionBaseUrl}/v1/models`).then((r) => (r.ok ? r.json() : null));
      const ids = (m?.data || []).map((x: { id: string }) => x.id).join(', ');
      this.message = ids ? `OK — models: ${ids}` : 'Reached companion but no models list.';
    } catch {
      this.message = 'Could not reach /v1/models.';
    }
  }

  async copy() {
    if (!this.json) this.json = (await this.desktop.openClawExample()) || '';
    await navigator.clipboard.writeText(this.json);
    this.message = 'Config copied to clipboard.';
  }
}
