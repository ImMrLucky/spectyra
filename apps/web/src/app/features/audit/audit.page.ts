import { Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ModalService } from '../../core/services/modal.service';

interface AuditLog {
  id: string;
  org_id: string;
  project_id: string | null;
  actor_type: 'USER' | 'API_KEY' | 'SYSTEM';
  actor_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: any;
  created_at: string;
}

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit.page.html',
  styleUrls: ['./audit.page.scss'],
})
export class AuditPage implements OnInit {
  logs: AuditLog[] = [];
  loading = false;
  error: string | null = null;
  selectedRange: '24h' | '7d' | '30d' | '90d' = '30d';
  selectedEventType: string | null = null;

  constructor(
    private http: HttpClient,
    private modalService: ModalService
  ) {}

  async ngOnInit() {
    await this.loadLogs();
  }

  async loadLogs() {
    this.loading = true;
    this.error = null;

    try {
      const params = new URLSearchParams();
      params.set('range', this.selectedRange);
      if (this.selectedEventType) {
        params.set('event_type', this.selectedEventType);
      }

      const response = await firstValueFrom(this.http.get<{ logs: AuditLog[]; total: number }>(`${environment.apiUrl}/v1/audit?${params.toString()}`));
      this.logs = response?.logs || [];
    } catch (err: any) {
      if (err.status === 404) {
        // Endpoint doesn't exist yet - empty list is fine
        this.logs = [];
      } else {
        this.error = 'Failed to load audit logs';
      }
    } finally {
      this.loading = false;
    }
  }

  onFilterChange() {
    this.loadLogs();
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }

  getEventTypeLabel(action: string): string {
    const labels: { [key: string]: string } = {
      LOGIN: 'Login',
      LOGOUT: 'Logout',
      KEY_CREATED: 'Key Created',
      KEY_ROTATED: 'Key Rotated',
      KEY_REVOKED: 'Key Revoked',
      ORG_CREATED: 'Organization Created',
      MEMBER_ADDED: 'Member Added',
      MEMBER_REMOVED: 'Member Removed',
      MEMBER_ROLE_CHANGED: 'Role Changed',
      SETTINGS_UPDATED: 'Settings Updated',
      PROVIDER_KEY_SET: 'Provider Key Set',
      PROVIDER_KEY_REVOKED: 'Provider Key Revoked',
      EXPORT_DATA: 'Data Export',
      RETENTION_APPLIED: 'Retention Applied',
    };
    return labels[action] || action;
  }

  showDetails(log: AuditLog) {
    const details = {
      id: log.id,
      actor_type: log.actor_type,
      actor_id: log.actor_id,
      action: log.action,
      target_type: log.target_type,
      target_id: log.target_id,
      ip: log.ip,
      user_agent: log.user_agent,
      metadata: log.metadata,
      created_at: log.created_at,
    };
    this.modalService.showDetails(
      'Audit Log Details',
      JSON.stringify(details, null, 2)
    );
  }

  async exportLogs() {
    try {
      const from = new Date();
      from.setDate(from.getDate() - 30); // Last 30 days
      const to = new Date();
      
      const url = `${environment.apiUrl}/v1/audit/export?from=${from.toISOString()}&to=${to.toISOString()}`;
      window.open(url, '_blank');
    } catch (err: any) {
      console.error('Failed to export logs:', err);
    }
  }
}
