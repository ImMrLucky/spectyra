import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Policy {
  id: string;
  name: string;
  type: 'budget' | 'model_routing' | 'tool' | 'data_handling';
  enabled: boolean;
  config: any;
  created_at: string;
  updated_at: string;
}

@Component({
  selector: 'app-policies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './policies.page.html',
  styleUrls: ['./policies.page.scss'],
})
export class PoliciesPage implements OnInit {
  policies: Policy[] = [];
  loading = false;
  error: string | null = null;
  showCreateForm = false;
  selectedPolicyType: Policy['type'] | null = null;

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    await this.loadPolicies();
  }

  async loadPolicies() {
    this.loading = true;
    this.error = null;

    try {
      const policies = await this.http.get<Policy[]>(`${environment.apiUrl}/policies`).toPromise();
      this.policies = policies || [];
    } catch (err: any) {
      if (err.status === 404) {
        // Endpoint doesn't exist yet - empty list is fine
        this.policies = [];
      } else {
        this.error = 'Failed to load policies';
      }
    } finally {
      this.loading = false;
    }
  }

  openCreateForm(type: Policy['type']) {
    this.selectedPolicyType = type;
    this.showCreateForm = true;
  }

  closeCreateForm() {
    this.showCreateForm = false;
    this.selectedPolicyType = null;
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }
}
