import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface AuditLog {
  id: string;
  event_type: 'key_created' | 'key_rotated' | 'key_revoked' | 'policy_created' | 'policy_updated' | 'policy_deleted' | 'member_added' | 'member_removed' | 'member_role_changed' | 'integration_changed' | 'run_deleted' | 'security_event';
  actor: string; // user_id or system
  target: string; // resource affected
  details: any;
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

  constructor(private http: HttpClient) {}

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

      const logs = await this.http.get<AuditLog[]>(`${environment.apiUrl}/audit?${params.toString()}`).toPromise();
      this.logs = logs || [];
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

  getEventTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      key_created: 'Key Created',
      key_rotated: 'Key Rotated',
      key_revoked: 'Key Revoked',
      policy_created: 'Policy Created',
      policy_updated: 'Policy Updated',
      policy_deleted: 'Policy Deleted',
      member_added: 'Member Added',
      member_removed: 'Member Removed',
      member_role_changed: 'Role Changed',
      integration_changed: 'Integration Changed',
      run_deleted: 'Run Deleted',
      security_event: 'Security Event',
    };
    return labels[type] || type;
  }

  showDetails(log: AuditLog) {
    alert(JSON.stringify(log.details, null, 2));
  }
}
