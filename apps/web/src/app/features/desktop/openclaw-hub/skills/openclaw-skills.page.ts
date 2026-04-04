import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OpenClawDesktopService, type SkillSearchResult, type InstalledSkill } from '../../../../core/desktop/openclaw-desktop.service';

const RECOMMENDED_SKILLS: Array<{ name: string; description: string; forRoles: string[] }> = [
  { name: 'web-search', description: 'Search the web for real-time information.', forRoles: ['AI Assistant', 'Research Assistant'] },
  { name: 'file-manager', description: 'Read, write, and manage files in your workspace.', forRoles: ['AI Assistant', 'AI Coder', 'Research Assistant'] },
  { name: 'code-review', description: 'Review code changes and suggest improvements.', forRoles: ['AI Coder'] },
  { name: 'test-runner', description: 'Run tests and report results.', forRoles: ['AI Coder'] },
  { name: 'git-tools', description: 'Git operations: status, diff, commit, branch management.', forRoles: ['AI Coder'] },
  { name: 'calculator', description: 'Perform mathematical calculations.', forRoles: ['AI Assistant', 'Research Assistant'] },
  { name: 'image-gen', description: 'Generate images from text descriptions.', forRoles: ['Social / Content Assistant'] },
  { name: 'scheduler', description: 'Schedule and manage recurring tasks.', forRoles: ['Ops / Automation Assistant'] },
  { name: 'api-client', description: 'Make HTTP requests to external APIs.', forRoles: ['Ops / Automation Assistant'] },
];

@Component({
  selector: 'app-openclaw-skills',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sk">
      <div class="sk-search">
        <input class="sk-input" type="text" placeholder="Search ClawHub skills…"
               [(ngModel)]="query" (keyup.enter)="search()" />
        <button class="btn-primary btn-sm" (click)="search()" [disabled]="searching">
          {{ searching ? 'Searching…' : 'Search' }}
        </button>
        <button class="btn-secondary btn-sm" (click)="updateAll()" [disabled]="updating">
          {{ updating ? 'Updating…' : 'Update All' }}
        </button>
      </div>

      <div class="sk-error" *ngIf="error">{{ error }}</div>
      <div class="sk-success" *ngIf="successMsg">{{ successMsg }}</div>

      <!-- Search results -->
      <div class="sk-section" *ngIf="searchResults.length > 0">
        <h2 class="sk-section-title">Search Results</h2>
        <div class="sk-grid">
          <div class="sk-card" *ngFor="let r of searchResults">
            <div class="sk-card-head">
              <span class="sk-name">{{ r.name }}</span>
              <span class="sk-installed-badge" *ngIf="isInstalled(r.name)">Installed</span>
            </div>
            <p class="sk-desc">{{ r.description || 'No description' }}</p>
            <button class="btn-primary btn-xs" *ngIf="!isInstalled(r.name)"
                    (click)="install(r.name)" [disabled]="installing === r.name">
              {{ installing === r.name ? 'Installing…' : 'Install' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Installed skills -->
      <div class="sk-section">
        <h2 class="sk-section-title">Installed Skills</h2>
        <div class="sk-empty" *ngIf="installed.length === 0 && !loadingInstalled">
          <p>No skills installed yet. Search ClawHub above or install recommended skills below.</p>
        </div>
        <div class="sk-grid" *ngIf="installed.length > 0">
          <div class="sk-card" *ngFor="let s of installed">
            <div class="sk-card-head">
              <span class="sk-name">{{ s.name }}</span>
              <span class="sk-version" *ngIf="s.version">v{{ s.version }}</span>
            </div>
            <p class="sk-desc">{{ getRecommendedDesc(s.name) || s.raw }}</p>
          </div>
        </div>
      </div>

      <!-- Recommended by role -->
      <div class="sk-section">
        <h2 class="sk-section-title">Recommended Skills</h2>
        <p class="sk-section-desc">Popular skills organized by assistant role.</p>
        <div class="sk-grid">
          <div class="sk-card recommend" *ngFor="let r of recommended">
            <div class="sk-card-head">
              <span class="sk-name">{{ r.name }}</span>
              <span class="sk-installed-badge" *ngIf="isInstalled(r.name)">Installed</span>
            </div>
            <p class="sk-desc">{{ r.description }}</p>
            <div class="sk-roles">
              <span class="sk-role-tag" *ngFor="let role of r.forRoles">{{ role }}</span>
            </div>
            <button class="btn-primary btn-xs" *ngIf="!isInstalled(r.name)"
                    (click)="install(r.name)" [disabled]="installing === r.name">
              {{ installing === r.name ? 'Installing…' : 'Install' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sk { }
    .sk-search { display: flex; gap: 8px; align-items: center; margin-bottom: 20px; }
    .sk-input {
      flex: 1; padding: 8px 12px; border: 1px solid var(--border-bright, rgba(255,255,255,0.12));
      border-radius: 8px; background: var(--bg-input, rgba(0,0,0,0.25)); color: var(--text-primary, #fff);
      font-size: 13px; outline: none;
    }
    .sk-input:focus { border-color: var(--spectyra-blue, #5b8def); }
    .btn-sm { font-size: 12px; padding: 7px 14px; }
    .btn-xs { font-size: 11px; padding: 5px 12px; margin-top: 8px; }

    .sk-error { color: var(--spectyra-red, #ef4444); font-size: 12px; margin-bottom: 12px; }
    .sk-success { color: var(--spectyra-green, #22c55e); font-size: 12px; margin-bottom: 12px; }

    .sk-section { margin-bottom: 28px; }
    .sk-section-title { font-size: 14px; font-weight: 600; color: var(--text-primary, #fff); margin: 0 0 6px; }
    .sk-section-desc { font-size: 12px; color: var(--text-muted, rgba(255,255,255,0.45)); margin: 0 0 12px; }

    .sk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
    .sk-card {
      background: var(--bg-card, rgba(255,255,255,0.04));
      border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
      border-radius: 10px; padding: 14px 16px;
    }
    .sk-card.recommend { border-color: rgba(91,141,239,0.15); }
    .sk-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .sk-name { font-size: 13px; font-weight: 600; color: var(--text-primary, #fff); }
    .sk-version { font-size: 11px; color: var(--text-muted, rgba(255,255,255,0.4)); }
    .sk-installed-badge {
      font-size: 10px; padding: 2px 6px; border-radius: 4px;
      background: rgba(34,197,94,0.15); color: #22c55e; font-weight: 600;
    }
    .sk-desc { font-size: 12px; color: var(--text-secondary, rgba(255,255,255,0.6)); margin: 4px 0 0; }
    .sk-roles { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .sk-role-tag {
      font-size: 10px; padding: 2px 6px; border-radius: 4px;
      background: rgba(91,141,239,0.1); color: var(--spectyra-blue, #5b8def);
    }
    .sk-empty { padding: 24px; text-align: center; }
    .sk-empty p { font-size: 13px; color: var(--text-muted, rgba(255,255,255,0.4)); }
  `],
})
export class OpenClawSkillsPage implements OnInit {
  private readonly svc = inject(OpenClawDesktopService);

  readonly recommended = RECOMMENDED_SKILLS;
  query = '';
  searchResults: SkillSearchResult[] = [];
  installed: InstalledSkill[] = [];
  searching = false;
  installing: string | null = null;
  updating = false;
  loadingInstalled = true;
  error: string | null = null;
  successMsg: string | null = null;

  ngOnInit() {
    void this.loadInstalled();
  }

  async loadInstalled() {
    this.loadingInstalled = true;
    this.installed = await this.svc.loadInstalledSkills();
    this.loadingInstalled = false;
  }

  async search() {
    if (!this.query.trim()) return;
    this.searching = true;
    this.error = null;
    this.searchResults = await this.svc.searchSkills(this.query.trim());
    this.searching = false;
  }

  async install(name: string) {
    this.installing = name;
    this.error = null;
    this.successMsg = null;
    const r = await this.svc.installSkill(name);
    if (r.ok) {
      this.successMsg = `Installed ${name}`;
      this.installed = this.svc.installedSkills();
    } else {
      this.error = r.error || 'Install failed';
    }
    this.installing = null;
  }

  async updateAll() {
    this.updating = true;
    this.error = null;
    this.successMsg = null;
    const r = await this.svc.updateSkills();
    if (r.ok) {
      this.successMsg = 'All skills updated';
      this.installed = this.svc.installedSkills();
    } else {
      this.error = r.error || 'Update failed';
    }
    this.updating = false;
  }

  isInstalled(name: string): boolean {
    return this.installed.some((s) => s.name === name);
  }

  getRecommendedDesc(name: string): string {
    return RECOMMENDED_SKILLS.find((r) => r.name === name)?.description ?? '';
  }
}
