import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OpenClawDesktopService } from '../../../../core/desktop/openclaw-desktop.service';
import type { AssistantProfile } from '../../../../../spectyra-window';

@Component({
  selector: 'app-openclaw-assistants',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ap">
      <!-- Editor -->
      <div class="ap-editor" *ngIf="editing">
        <h2 class="ap-editor-title">{{ editing.id ? 'Edit' : 'New' }} Assistant Profile</h2>
        <div class="ap-form">
          <div class="ap-field">
            <label class="ap-label">Name</label>
            <input class="ap-input" [(ngModel)]="editing.name" placeholder="e.g. AI Coder" />
          </div>
          <div class="ap-field">
            <label class="ap-label">Role</label>
            <input class="ap-input" [(ngModel)]="editing.role" placeholder="e.g. Software engineering assistant" />
          </div>
          <div class="ap-field">
            <label class="ap-label">System Prompt / Identity Template</label>
            <textarea class="ap-textarea" [(ngModel)]="editing.systemPrompt" rows="6"
                      placeholder="You are a …"></textarea>
          </div>
          <div class="ap-field">
            <label class="ap-label">Skills (comma-separated)</label>
            <input class="ap-input" [(ngModel)]="skillsInput" placeholder="web-search, file-manager, code-review" />
          </div>
          <div class="ap-field">
            <label class="ap-label">Heartbeat / Task Template (optional)</label>
            <textarea class="ap-textarea" [(ngModel)]="editing.heartbeatTemplate" rows="4"
                      placeholder="# HEARTBEAT.md\n\nCheck …"></textarea>
          </div>
          <div class="ap-field">
            <label class="ap-label">Notes</label>
            <textarea class="ap-textarea" [(ngModel)]="editing.notes" rows="2"
                      placeholder="Usage notes, tips, context…"></textarea>
          </div>
          <div class="ap-editor-actions">
            <button class="btn-primary" (click)="saveProfile()" [disabled]="saving">
              {{ saving ? 'Saving…' : 'Save Profile' }}
            </button>
            <button class="btn-secondary" (click)="cancelEdit()">Cancel</button>
          </div>
          <div class="ap-error" *ngIf="error">{{ error }}</div>
        </div>
      </div>

      <!-- List -->
      <div class="ap-list" *ngIf="!editing">
        <div class="ap-list-header">
          <h2 class="ap-section-title">Assistant Profiles</h2>
          <button class="btn-primary btn-sm" (click)="newProfile()">New Profile</button>
        </div>
        <p class="ap-section-desc">
          Define reusable assistant identities. Each profile specifies a system prompt, recommended skills, and optional task templates.
          Profiles are stored locally and generate OpenClaw-friendly configuration.
        </p>

        <div class="ap-empty" *ngIf="profiles.length === 0 && !loading">
          <p>No assistant profiles yet. Create one or use the defaults.</p>
          <button class="btn-secondary btn-sm" (click)="loadDefaults()">Load Default Profiles</button>
        </div>

        <div class="ap-grid">
          <div class="ap-card" *ngFor="let p of profiles">
            <div class="ap-card-head">
              <span class="ap-card-name">{{ p.name }}</span>
              <span class="ap-card-role">{{ p.role }}</span>
            </div>
            <p class="ap-card-prompt">{{ truncate(p.systemPrompt, 120) }}</p>
            <div class="ap-card-skills" *ngIf="p.skills.length">
              <span class="ap-skill-tag" *ngFor="let sk of p.skills">{{ sk }}</span>
            </div>
            <p class="ap-card-notes" *ngIf="p.notes">{{ p.notes }}</p>
            <div class="ap-card-actions">
              <button class="btn-secondary btn-xs" (click)="editProfile(p)">Edit</button>
              <button class="btn-secondary btn-xs" (click)="duplicate(p)">Duplicate</button>
              <button class="btn-danger btn-xs" (click)="deleteProfile(p.id)">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ap {}
    .ap-list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .ap-section-title { font-size: 14px; font-weight: 600; color: var(--text-primary, #fff); margin: 0; }
    .ap-section-desc { font-size: 12px; color: var(--text-muted, rgba(255,255,255,0.45)); margin: 0 0 16px; }

    .ap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
    .ap-card {
      background: var(--bg-card, rgba(255,255,255,0.04));
      border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
      border-radius: 10px; padding: 16px 18px;
    }
    .ap-card-head { margin-bottom: 6px; }
    .ap-card-name { font-size: 14px; font-weight: 600; color: var(--text-primary, #fff); display: block; }
    .ap-card-role { font-size: 11px; color: var(--text-muted, rgba(255,255,255,0.45)); }
    .ap-card-prompt {
      font-size: 12px; color: var(--text-secondary, rgba(255,255,255,0.6));
      margin: 6px 0; white-space: pre-line; font-family: 'DM Mono', monospace;
      background: rgba(0,0,0,0.2); padding: 8px 10px; border-radius: 6px;
    }
    .ap-card-skills { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; }
    .ap-skill-tag {
      font-size: 10px; padding: 2px 6px; border-radius: 4px;
      background: rgba(91,141,239,0.1); color: var(--spectyra-blue, #5b8def);
    }
    .ap-card-notes { font-size: 11px; color: var(--text-muted, rgba(255,255,255,0.4)); margin: 4px 0 0; font-style: italic; }
    .ap-card-actions { display: flex; gap: 6px; margin-top: 10px; }
    .btn-xs { font-size: 11px; padding: 4px 10px; }
    .btn-sm { font-size: 12px; padding: 6px 14px; }
    .btn-danger { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); border-radius: 6px; cursor: pointer; }
    .btn-danger:hover { background: rgba(239,68,68,0.25); }

    .ap-editor { max-width: 600px; }
    .ap-editor-title { font-size: 16px; font-weight: 600; color: var(--text-primary, #fff); margin: 0 0 16px; }
    .ap-form { display: flex; flex-direction: column; gap: 14px; }
    .ap-field { display: flex; flex-direction: column; gap: 4px; }
    .ap-label { font-size: 12px; font-weight: 500; color: var(--text-secondary, rgba(255,255,255,0.65)); }
    .ap-input {
      padding: 8px 12px; border: 1px solid var(--border-bright, rgba(255,255,255,0.12));
      border-radius: 8px; background: var(--bg-input, rgba(0,0,0,0.25)); color: var(--text-primary, #fff);
      font-size: 13px; outline: none;
    }
    .ap-input:focus, .ap-textarea:focus { border-color: var(--spectyra-blue, #5b8def); }
    .ap-textarea {
      padding: 8px 12px; border: 1px solid var(--border-bright, rgba(255,255,255,0.12));
      border-radius: 8px; background: var(--bg-input, rgba(0,0,0,0.25)); color: var(--text-primary, #fff);
      font-size: 13px; outline: none; font-family: 'DM Mono', monospace; resize: vertical;
    }
    .ap-editor-actions { display: flex; gap: 8px; margin-top: 4px; }
    .ap-error { color: var(--spectyra-red, #ef4444); font-size: 12px; }
    .ap-empty { padding: 24px; text-align: center; }
    .ap-empty p { font-size: 13px; color: var(--text-muted, rgba(255,255,255,0.4)); margin-bottom: 12px; }
  `],
})
export class OpenClawAssistantsPage implements OnInit {
  private readonly svc = inject(OpenClawDesktopService);

  profiles: AssistantProfile[] = [];
  editing: AssistantProfile | null = null;
  skillsInput = '';
  saving = false;
  loading = true;
  error: string | null = null;

  ngOnInit() {
    void this.load();
  }

  async load() {
    this.loading = true;
    this.profiles = await this.svc.loadProfiles();
    this.loading = false;
  }

  newProfile() {
    this.editing = {
      id: `profile-${Date.now()}`,
      name: '',
      role: '',
      systemPrompt: '',
      skills: [],
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.skillsInput = '';
    this.error = null;
  }

  editProfile(p: AssistantProfile) {
    this.editing = { ...p };
    this.skillsInput = p.skills.join(', ');
    this.error = null;
  }

  duplicate(p: AssistantProfile) {
    this.editing = {
      ...p,
      id: `profile-${Date.now()}`,
      name: `${p.name} (copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.skillsInput = p.skills.join(', ');
    this.error = null;
  }

  async saveProfile() {
    if (!this.editing) return;
    if (!this.editing.name.trim()) {
      this.error = 'Name is required';
      return;
    }
    this.saving = true;
    this.error = null;
    this.editing.skills = this.skillsInput.split(',').map((s) => s.trim()).filter(Boolean);
    await this.svc.saveProfile(this.editing);
    this.profiles = this.svc.profiles();
    this.editing = null;
    this.saving = false;
  }

  cancelEdit() {
    this.editing = null;
    this.error = null;
  }

  async deleteProfile(id: string) {
    await this.svc.deleteProfile(id);
    this.profiles = this.svc.profiles();
  }

  async loadDefaults() {
    this.loading = true;
    this.profiles = await this.svc.loadProfiles();
    this.loading = false;
  }

  truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }
}
