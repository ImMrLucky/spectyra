import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-agent-companion-landing',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule],
  template: `
    <div class="wrap">
      <header class="hero">
        <h1>Agent Companion</h1>
        <p class="sub">Set up or connect your AI agent environment — OpenClaw, SDK apps, Claude-style runtimes, or generic logs.</p>
      </header>

      <div class="grid">
        <mat-card class="tile">
          <mat-card-title>Start a new environment</mat-card-title>
          <mat-card-content>
            <p>Guided setup for OpenClaw and compatible local endpoints.</p>
            <a mat-raised-button color="primary" routerLink="/desktop/onboarding">Open setup</a>
          </mat-card-content>
        </mat-card>
        <mat-card class="tile">
          <mat-card-title>Connect an existing agent</mat-card-title>
          <mat-card-content>
            <p>Attach Spectyra to OpenClaw, SDK, or JSONL / traces.</p>
            <a mat-stroked-button color="primary" routerLink="/desktop/openclaw">OpenClaw wizard</a>
            <a mat-button routerLink="/desktop/live">Go live</a>
          </mat-card-content>
        </mat-card>
      </div>

      <p class="examples">Examples, not limits — coding, browser automation, research, messaging, scheduled jobs.</p>
    </div>
  `,
  styles: [
    `
      .wrap {
        max-width: 900px;
        margin: 0 auto;
        padding: 28px 24px 48px;
      }
      .hero h1 {
        margin: 0 0 8px;
        font-size: 1.85rem;
      }
      .sub {
        color: #64748b;
        line-height: 1.55;
        margin-bottom: 24px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 18px;
      }
      .tile mat-card-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }
      .examples {
        margin-top: 28px;
        font-size: 0.85rem;
        color: #94a3b8;
      }
    `,
  ],
})
export class AgentCompanionLandingPage {}
