import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-desktop-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule],
  template: `
    <div class="wrap">
      <h1>Settings</h1>
      <p class="sub">Desktop preferences and companion configuration.</p>
      <mat-card class="card">
        <mat-card-title>Companion</mat-card-title>
        <mat-card-content>
          <p>Provider keys, port, and run mode are configured during onboarding.</p>
          <a mat-stroked-button routerLink="/desktop/onboarding">Open onboarding</a>
        </mat-card-content>
      </mat-card>
      <mat-card class="card">
        <mat-card-title>Integrations</mat-card-title>
        <mat-card-content>
          <a mat-button routerLink="/desktop/openclaw">OpenClaw</a>
          <a mat-button routerLink="/integrations">Web integrations</a>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .wrap {
        max-width: 720px;
        margin: 0 auto;
        padding: 24px;
      }
      .sub {
        color: #64748b;
        margin-bottom: 16px;
      }
      .card {
        margin-bottom: 14px;
      }
    `,
  ],
})
export class DesktopSettingsPage {}
