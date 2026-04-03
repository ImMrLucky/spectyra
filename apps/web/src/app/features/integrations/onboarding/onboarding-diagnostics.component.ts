import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { IntegrationDiagnostics } from '../models/integration-onboarding.types';

@Component({
  selector: 'app-onboarding-diagnostics',
  standalone: true,
  imports: [CommonModule],
  template: `
    <details class="od" [open]="expanded">
      <summary class="od-sum">Diagnostics</summary>
      <div class="od-body">
        <p class="od-meta" *ngIf="lastRefresh">Last refresh: {{ lastRefresh | date : 'medium' }}</p>
        <p class="od-meta" *ngIf="companionBaseUrl">Local base URL: <code>{{ companionBaseUrl }}</code></p>
        <p class="od-meta" *ngIf="modelAliases?.length">Model aliases: <code>{{ (modelAliases ?? []).join(', ') }}</code></p>
        <button type="button" class="od-retry" (click)="retry.emit()">Retry</button>
        <label class="od-toggle"
          ><input type="checkbox" [checked]="showRaw" (change)="showRaw = $any($event.target).checked" /> Show raw
          JSON</label
        >
        <pre class="od-raw" *ngIf="showRaw && diagnostics">{{ diagnostics | json }}</pre>
      </div>
    </details>
  `,
  styles: [
    `
      .od {
        margin-top: 20px;
        border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
        border-radius: 8px;
        padding: 8px 12px;
        background: var(--bg-elevated, rgba(0, 0, 0, 0.2));
      }
      .od-sum {
        cursor: pointer;
        font-size: 12px;
        color: var(--text-muted, #8892a0);
      }
      .od-body {
        margin-top: 10px;
        font-size: 12px;
        color: var(--text-secondary, #b8c0cc);
      }
      .od-meta code {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
      }
      .od-retry {
        margin-top: 8px;
        padding: 4px 10px;
        font-size: 12px;
        cursor: pointer;
      }
      .od-toggle {
        display: block;
        margin-top: 8px;
        font-size: 11px;
      }
      .od-raw {
        margin-top: 8px;
        max-height: 200px;
        overflow: auto;
        font-size: 10px;
      }
    `,
  ],
})
export class OnboardingDiagnosticsComponent {
  @Input() diagnostics: IntegrationDiagnostics | null = null;
  @Input() lastRefresh: Date | null = null;
  @Input() companionBaseUrl: string | null = null;
  @Input() modelAliases: string[] | undefined = undefined;
  @Input() expanded = false;
  @Output() retry = new EventEmitter<void>();

  showRaw = false;
}
