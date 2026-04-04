import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OpenClawDesktopService } from '../../../../core/desktop/openclaw-desktop.service';
import type { TaskTemplate } from '../../../../../spectyra-window';

const TASK_TYPE_LABELS: Record<string, string> = {
  heartbeat: 'Heartbeat',
  daily: 'Daily Summary',
  watcher: 'Watch & Alert',
  checklist: 'Checklist',
};

const STARTER_TEMPLATES: Array<{ label: string; type: TaskTemplate['type']; prompt: string; schedule?: string; fileContent?: string }> = [
  {
    label: 'Daily Briefing',
    type: 'daily',
    schedule: '0 9 * * *',
    prompt: 'Summarize the most important updates from the past 24 hours. Include any pending items that need attention today. Highlight anything blocking.',
  },
  {
    label: 'Inbox / Issue Watcher',
    type: 'watcher',
    schedule: '*/15 * * * *',
    prompt: 'Check for new issues or messages. If any are critical or time-sensitive, alert immediately with a summary and suggested action.',
  },
  {
    label: 'CI Monitor',
    type: 'watcher',
    schedule: '*/10 * * * *',
    prompt: 'Check CI pipeline status. Report any failed builds or tests. Include the branch name, failure reason, and a link if available.',
  },
  {
    label: 'PR Follow-Up',
    type: 'daily',
    schedule: '0 10 * * 1-5',
    prompt: 'Review open pull requests. Identify any that are stale (no activity for 2+ days) or need my review. Suggest next actions.',
  },
  {
    label: 'Health Check Heartbeat',
    type: 'heartbeat',
    schedule: '*/30 * * * *',
    prompt: 'Run a health check on configured services. Report status and any anomalies.',
    fileContent: '# HEARTBEAT.md\n\nRun a health check every 30 minutes.\n\n## Checks\n- Service endpoints respond\n- Error rate below threshold\n- Disk and memory usage normal\n\n## On Failure\nAlert with service name, check type, and observed value.\n',
  },
];

@Component({
  selector: 'app-openclaw-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tk">
      <!-- Editor -->
      <div class="tk-editor" *ngIf="editing">
        <h2 class="tk-editor-title">{{ editing.id ? 'Edit' : 'New' }} Task</h2>
        <div class="tk-form">
          <div class="tk-field">
            <label class="tk-label">Name</label>
            <input class="tk-input" [(ngModel)]="editing.name" placeholder="e.g. Daily Briefing" />
          </div>
          <div class="tk-field">
            <label class="tk-label">Type</label>
            <select class="tk-select" [(ngModel)]="editing.type">
              <option value="heartbeat">Heartbeat</option>
              <option value="daily">Daily Summary</option>
              <option value="watcher">Watch &amp; Alert</option>
              <option value="checklist">Checklist</option>
            </select>
          </div>
          <div class="tk-field" *ngIf="editing.type !== 'checklist'">
            <label class="tk-label">Schedule (cron)</label>
            <input class="tk-input" [(ngModel)]="editing.schedule" placeholder="*/30 * * * *" />
            <span class="tk-hint">Standard cron syntax. Leave empty for manual trigger.</span>
          </div>
          <div class="tk-field">
            <label class="tk-label">Prompt / Instructions</label>
            <textarea class="tk-textarea" [(ngModel)]="editing.prompt" rows="5"
                      placeholder="What should the assistant do?"></textarea>
          </div>
          <div class="tk-field" *ngIf="editing.type === 'heartbeat'">
            <label class="tk-label">HEARTBEAT.md Content (preview)</label>
            <textarea class="tk-textarea mono" [(ngModel)]="editing.fileContent" rows="8"
                      placeholder="# HEARTBEAT.md\n\nDescribe checks…"></textarea>
            <span class="tk-hint">This content will be written to HEARTBEAT.md in your OpenClaw workspace.</span>
          </div>
          <div class="tk-field">
            <label class="tk-label">Notes</label>
            <textarea class="tk-textarea" [(ngModel)]="editing.notes" rows="2"
                      placeholder="Usage notes, context…"></textarea>
          </div>
          <div class="tk-editor-actions">
            <button class="btn-primary" (click)="saveTask()" [disabled]="saving">
              {{ saving ? 'Saving…' : 'Save Task' }}
            </button>
            <button class="btn-secondary" (click)="cancelEdit()">Cancel</button>
          </div>
          <div class="tk-error" *ngIf="error">{{ error }}</div>
        </div>
      </div>

      <!-- List -->
      <div class="tk-list" *ngIf="!editing">
        <div class="tk-list-header">
          <h2 class="tk-section-title">Tasks &amp; Jobs</h2>
          <button class="btn-primary btn-sm" (click)="newTask()">New Task</button>
        </div>
        <p class="tk-section-desc">
          Configure recurring tasks, heartbeat checks, and automated routines. Tasks generate OpenClaw-friendly
          workspace files (like HEARTBEAT.md) and scheduling configurations.
        </p>

        <div class="tk-grid">
          <div class="tk-card" *ngFor="let t of tasks">
            <div class="tk-card-head">
              <span class="tk-card-name">{{ t.name }}</span>
              <span class="tk-type-badge">{{ typeLabel(t.type) }}</span>
            </div>
            <p class="tk-card-prompt">{{ truncate(t.prompt, 100) }}</p>
            <span class="tk-schedule" *ngIf="t.schedule">{{ t.schedule }}</span>
            <p class="tk-card-notes" *ngIf="t.notes">{{ t.notes }}</p>
            <div class="tk-card-actions">
              <button class="btn-secondary btn-xs" (click)="editTask(t)">Edit</button>
              <button class="btn-secondary btn-xs" *ngIf="t.fileContent" (click)="previewFile(t)">Preview File</button>
              <button class="btn-danger btn-xs" (click)="deleteTask(t.id)">Delete</button>
            </div>
          </div>
        </div>

        <div class="tk-starters" *ngIf="tasks.length < 3">
          <h3 class="tk-section-title">Starter Templates</h3>
          <p class="tk-section-desc">Quick-start with common task patterns.</p>
          <div class="tk-starter-grid">
            <button class="tk-starter-card" *ngFor="let t of starters" (click)="useStarter(t)">
              <span class="tk-starter-label">{{ t.label }}</span>
              <span class="tk-starter-type">{{ typeLabel(t.type) }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- File preview modal -->
      <div class="tk-preview-overlay" *ngIf="previewContent" (click)="previewContent = null">
        <div class="tk-preview-modal" (click)="$event.stopPropagation()">
          <h3 class="tk-preview-title">File Preview</h3>
          <pre class="tk-preview-code">{{ previewContent }}</pre>
          <div class="tk-preview-actions">
            <button class="btn-secondary btn-sm" (click)="copyPreview()">Copy</button>
            <button class="btn-secondary btn-sm" (click)="previewContent = null">Close</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tk {}
    .tk-list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .tk-section-title { font-size: 14px; font-weight: 600; color: var(--text-primary, #fff); margin: 0; }
    .tk-section-desc { font-size: 12px; color: var(--text-muted, rgba(255,255,255,0.45)); margin: 0 0 16px; }

    .tk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-bottom: 28px; }
    .tk-card {
      background: var(--bg-card, rgba(255,255,255,0.04));
      border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
      border-radius: 10px; padding: 16px 18px;
    }
    .tk-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .tk-card-name { font-size: 14px; font-weight: 600; color: var(--text-primary, #fff); }
    .tk-type-badge {
      font-size: 10px; padding: 2px 6px; border-radius: 4px;
      background: rgba(234,179,8,0.12); color: #eab308; font-weight: 600;
    }
    .tk-card-prompt {
      font-size: 12px; color: var(--text-secondary, rgba(255,255,255,0.6));
      margin: 6px 0; white-space: pre-line;
    }
    .tk-schedule { font-size: 11px; color: var(--text-muted, rgba(255,255,255,0.4)); font-family: 'DM Mono', monospace; }
    .tk-card-notes { font-size: 11px; color: var(--text-muted, rgba(255,255,255,0.4)); margin: 4px 0 0; font-style: italic; }
    .tk-card-actions { display: flex; gap: 6px; margin-top: 10px; }
    .btn-xs { font-size: 11px; padding: 4px 10px; }
    .btn-sm { font-size: 12px; padding: 6px 14px; }
    .btn-danger { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); border-radius: 6px; cursor: pointer; }
    .btn-danger:hover { background: rgba(239,68,68,0.25); }

    .tk-starters { margin-top: 8px; }
    .tk-starter-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
    .tk-starter-card {
      background: var(--bg-card, rgba(255,255,255,0.04));
      border: 1px solid rgba(91,141,239,0.15);
      border-radius: 8px; padding: 12px 14px; cursor: pointer;
      display: flex; flex-direction: column; gap: 4px;
      transition: border-color 0.15s;
    }
    .tk-starter-card:hover { border-color: var(--spectyra-blue, #5b8def); }
    .tk-starter-label { font-size: 12px; font-weight: 600; color: var(--text-primary, #fff); }
    .tk-starter-type { font-size: 10px; color: var(--text-muted, rgba(255,255,255,0.4)); }

    .tk-editor { max-width: 600px; }
    .tk-editor-title { font-size: 16px; font-weight: 600; color: var(--text-primary, #fff); margin: 0 0 16px; }
    .tk-form { display: flex; flex-direction: column; gap: 14px; }
    .tk-field { display: flex; flex-direction: column; gap: 4px; }
    .tk-label { font-size: 12px; font-weight: 500; color: var(--text-secondary, rgba(255,255,255,0.65)); }
    .tk-input, .tk-select {
      padding: 8px 12px; border: 1px solid var(--border-bright, rgba(255,255,255,0.12));
      border-radius: 8px; background: var(--bg-input, rgba(0,0,0,0.25)); color: var(--text-primary, #fff);
      font-size: 13px; outline: none;
    }
    .tk-input:focus, .tk-textarea:focus, .tk-select:focus { border-color: var(--spectyra-blue, #5b8def); }
    .tk-textarea {
      padding: 8px 12px; border: 1px solid var(--border-bright, rgba(255,255,255,0.12));
      border-radius: 8px; background: var(--bg-input, rgba(0,0,0,0.25)); color: var(--text-primary, #fff);
      font-size: 13px; outline: none; resize: vertical;
    }
    .tk-textarea.mono { font-family: 'DM Mono', monospace; }
    .tk-hint { font-size: 11px; color: var(--text-muted, rgba(255,255,255,0.35)); }
    .tk-editor-actions { display: flex; gap: 8px; margin-top: 4px; }
    .tk-error { color: var(--spectyra-red, #ef4444); font-size: 12px; }

    .tk-preview-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center; z-index: 100;
    }
    .tk-preview-modal {
      background: var(--bg-surface, #1e1e2a); border: 1px solid var(--border-bright, rgba(255,255,255,0.12));
      border-radius: 12px; padding: 20px 24px; max-width: 600px; width: 90%; max-height: 80vh; overflow: auto;
    }
    .tk-preview-title { font-size: 14px; font-weight: 600; color: var(--text-primary, #fff); margin: 0 0 12px; }
    .tk-preview-code {
      background: rgba(0,0,0,0.3); padding: 14px; border-radius: 8px;
      font-family: 'DM Mono', monospace; font-size: 12px; color: var(--text-primary, #fff);
      white-space: pre-wrap; margin: 0 0 12px;
    }
    .tk-preview-actions { display: flex; gap: 8px; }
  `],
})
export class OpenClawTasksPage implements OnInit {
  private readonly svc = inject(OpenClawDesktopService);

  tasks: TaskTemplate[] = [];
  editing: TaskTemplate | null = null;
  saving = false;
  loading = true;
  error: string | null = null;
  previewContent: string | null = null;
  readonly starters = STARTER_TEMPLATES;

  ngOnInit() {
    void this.load();
  }

  async load() {
    this.loading = true;
    this.tasks = await this.svc.loadTasks();
    this.loading = false;
  }

  newTask() {
    this.editing = {
      id: `task-${Date.now()}`,
      name: '',
      type: 'daily',
      schedule: '',
      prompt: '',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.error = null;
  }

  editTask(t: TaskTemplate) {
    this.editing = { ...t };
    this.error = null;
  }

  useStarter(starter: typeof STARTER_TEMPLATES[0]) {
    this.editing = {
      id: `task-${Date.now()}`,
      name: starter.label,
      type: starter.type,
      schedule: starter.schedule,
      prompt: starter.prompt,
      fileContent: starter.fileContent,
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.error = null;
  }

  async saveTask() {
    if (!this.editing) return;
    if (!this.editing.name.trim()) {
      this.error = 'Name is required';
      return;
    }
    this.saving = true;
    this.error = null;
    await this.svc.saveTask(this.editing);
    this.tasks = this.svc.tasks();
    this.editing = null;
    this.saving = false;
  }

  cancelEdit() {
    this.editing = null;
    this.error = null;
  }

  async deleteTask(id: string) {
    await this.svc.deleteTask(id);
    this.tasks = this.svc.tasks();
  }

  previewFile(t: TaskTemplate) {
    this.previewContent = t.fileContent || '(No file content)';
  }

  async copyPreview() {
    if (this.previewContent) {
      await navigator.clipboard.writeText(this.previewContent);
    }
  }

  typeLabel(type: string): string {
    return TASK_TYPE_LABELS[type] || type;
  }

  truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }
}
