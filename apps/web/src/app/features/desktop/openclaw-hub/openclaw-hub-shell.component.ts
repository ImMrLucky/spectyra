import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-openclaw-hub-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="oc-hub">
      <div class="oc-hub-header">
        <h1 class="oc-hub-title">OpenClaw AI Assistant</h1>
        <p class="oc-hub-sub">Set up, manage, and monitor OpenClaw with Spectyra optimization.</p>
      </div>
      <nav class="oc-hub-nav">
        <a class="oc-tab" routerLink="overview" routerLinkActive="active">Overview</a>
        <a class="oc-tab" routerLink="setup" routerLinkActive="active">Setup</a>
        <a class="oc-tab" routerLink="skills" routerLinkActive="active">Skills</a>
        <a class="oc-tab" routerLink="assistants" routerLinkActive="active">Assistants</a>
        <a class="oc-tab" routerLink="tasks" routerLinkActive="active">Tasks</a>
        <a class="oc-tab" routerLink="diagnostics" routerLinkActive="active">Diagnostics</a>
      </nav>
      <div class="oc-hub-body">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [`
    .oc-hub { padding: 24px 28px 40px; max-width: 960px; }

    .oc-hub-header { margin-bottom: 20px; }
    .oc-hub-title {
      font-family: 'Source Sans Pro', 'DM Sans', sans-serif;
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary, #fff);
      margin: 0 0 4px;
    }
    .oc-hub-sub {
      font-size: 13px;
      color: var(--text-secondary, rgba(255,255,255,0.55));
      margin: 0;
    }

    .oc-hub-nav {
      display: flex;
      gap: 2px;
      border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
      margin-bottom: 24px;
    }
    .oc-tab {
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-muted, rgba(255,255,255,0.5));
      text-decoration: none;
      border-bottom: 2px solid transparent;
      transition: color 0.15s, border-color 0.15s;
    }
    .oc-tab:hover { color: var(--text-primary, #fff); }
    .oc-tab.active {
      color: var(--spectyra-blue, #5b8def);
      border-bottom-color: var(--spectyra-blue, #5b8def);
    }
  `],
})
export class OpenClawHubShell {}
