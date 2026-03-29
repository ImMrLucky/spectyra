import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { SuperuserService, type PlatformRole, type PlatformUserRow } from '../../core/api/superuser.service';
import { AdminService, type AdminOrg } from '../../core/api/admin.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-superuser-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatIconModule,
  ],
  template: `
    <div class="su-wrap">
      <h1>Platform superuser</h1>
      <p class="su-lead">
        Grant perpetual access by email (admin / exempt / superuser). Toggle org-level exempt for API-key and gateway
        testing without a paid subscription.
      </p>

      <mat-card class="su-card">
        <mat-card-title>Add or update user</mat-card-title>
        <mat-card-content class="su-form">
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput [(ngModel)]="newEmail" type="email" placeholder="user@example.com" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Role</mat-label>
            <mat-select [(ngModel)]="newRole">
              <mat-option value="exempt">exempt — free forever (dashboard)</mat-option>
              <mat-option value="admin">admin — free + owner-style admin panel</mat-option>
              <mat-option value="superuser">superuser — full platform console</mat-option>
            </mat-select>
          </mat-form-field>
          <button mat-raised-button color="primary" (click)="addUser()" [disabled]="saving || !newEmail.trim()">
            Save
          </button>
        </mat-card-content>
        <p class="su-err" *ngIf="error">{{ error }}</p>
        <p class="su-ok" *ngIf="message">{{ message }}</p>
      </mat-card>

      <mat-card class="su-card">
        <mat-card-title>Platform users</mat-card-title>
        <table mat-table [dataSource]="users" class="su-table" *ngIf="users.length">
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let row">{{ row.email }}</td>
          </ng-container>
          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef>Role</th>
            <td mat-cell *matCellDef="let row">{{ row.role }}</td>
          </ng-container>
          <ng-container matColumnDef="by">
            <th mat-header-cell *matHeaderCellDef>Created by</th>
            <td mat-cell *matCellDef="let row">{{ row.created_by_email || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let row">
              <button mat-icon-button color="warn" (click)="remove(row)" [disabled]="saving" aria-label="Remove">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
        </table>
        <p *ngIf="!users.length" class="muted">No rows (migration may not be applied yet).</p>
      </mat-card>

      <mat-card class="su-card">
        <mat-card-title>Organizations — platform exempt (API / chat)</mat-card-title>
        <p class="muted">
          When enabled, the org bypasses trial and subscription checks for all API-key traffic (including /v1/chat).
        </p>
        <div class="org-row" *ngFor="let o of orgs">
          <span class="mono">{{ o.name }}</span>
          <span class="oid">{{ o.id }}</span>
          <mat-slide-toggle
            [checked]="!!o.platform_exempt"
            (change)="toggleOrg(o, $event.checked)"
            [disabled]="saving"
          >
            Platform exempt
          </mat-slide-toggle>
        </div>
        <p *ngIf="!orgs.length" class="muted">No orgs loaded.</p>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .su-wrap {
        max-width: 960px;
        margin: 0 auto;
        padding: 24px;
      }
      h1 {
        margin: 0 0 8px;
      }
      .su-lead {
        color: #64748b;
        margin-bottom: 20px;
        line-height: 1.5;
      }
      .su-card {
        margin-bottom: 20px;
      }
      .su-form {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      mat-form-field {
        min-width: 220px;
      }
      .su-table {
        width: 100%;
      }
      .su-err {
        color: #b91c1c;
        font-size: 0.9rem;
      }
      .su-ok {
        color: #047857;
        font-size: 0.9rem;
      }
      .muted {
        color: #94a3b8;
        font-size: 0.9rem;
      }
      .org-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px 20px;
        padding: 10px 0;
        border-bottom: 1px solid #f1f5f9;
      }
      .oid {
        font-size: 0.75rem;
        color: #94a3b8;
        flex: 1;
        min-width: 120px;
        word-break: break-all;
      }
      .mono {
        font-weight: 600;
        min-width: 140px;
      }
    `,
  ],
})
export class SuperuserPage implements OnInit {
  users: PlatformUserRow[] = [];
  orgs: AdminOrg[] = [];
  cols = ['email', 'role', 'by', 'actions'];
  newEmail = '';
  newRole: PlatformRole = 'exempt';
  saving = false;
  error = '';
  message = '';

  constructor(
    private superuser: SuperuserService,
    private admin: AdminService,
  ) {}

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.error = '';
    forkJoin({
      pu: this.superuser.listPlatformUsers(),
      orgs: this.admin.listOrgs(),
    }).subscribe({
      next: ({ pu, orgs }) => {
        this.users = pu.users ?? [];
        this.orgs = orgs.orgs ?? [];
      },
      error: (e) => {
        this.error = e.error?.error || e.message || 'Failed to load';
      },
    });
  }

  addUser() {
    this.error = '';
    this.message = '';
    this.saving = true;
    this.superuser.upsertPlatformUser(this.newEmail.trim(), this.newRole).subscribe({
      next: () => {
        this.message = 'Saved.';
        this.newEmail = '';
        this.reload();
        this.saving = false;
      },
      error: (e) => {
        this.error = e.error?.error || e.message || 'Failed';
        this.saving = false;
      },
    });
  }

  remove(row: PlatformUserRow) {
    if (!confirm(`Remove platform role for ${row.email}?`)) return;
    this.saving = true;
    this.superuser.deletePlatformUser(row.email).subscribe({
      next: () => {
        this.reload();
        this.saving = false;
      },
      error: (e) => {
        this.error = e.error?.error || e.message || 'Failed';
        this.saving = false;
      },
    });
  }

  toggleOrg(o: AdminOrg, exempt: boolean) {
    this.saving = true;
    this.superuser.setOrgPlatformExempt(o.id, exempt).subscribe({
      next: (r) => {
        const ix = this.orgs.findIndex((x) => x.id === o.id);
        if (ix >= 0) this.orgs[ix] = { ...this.orgs[ix], ...r.org };
        this.saving = false;
      },
      error: (e) => {
        this.error = e.error?.error || e.message || 'Failed';
        this.saving = false;
        this.reload();
      },
    });
  }
}
