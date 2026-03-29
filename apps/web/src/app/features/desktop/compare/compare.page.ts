import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-desktop-compare',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule],
  template: `
    <div class="wrap">
      <h1>Compare</h1>
      <p class="sub">Original vs optimized prompts and unified diffs — open a run from Live → Prompt compare, or use Studio on the web.</p>
      <mat-card class="card">
        <mat-card-title>Quick path</mat-card-title>
        <mat-card-content>
          <ol>
            <li>Send traffic through the Local Companion.</li>
            <li>Open <a routerLink="/desktop/live">Live</a> → <strong>Prompt compare</strong> tab.</li>
            <li>Launch the local comparison viewer for the selected run.</li>
          </ol>
          <a mat-stroked-button color="primary" routerLink="/desktop/live">Go to Live</a>
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
        line-height: 1.5;
      }
      .card {
        margin-top: 12px;
      }
      ol {
        line-height: 1.7;
        color: #334155;
      }
    `,
  ],
})
export class DesktopComparePage {}
