import { Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { environment } from '../../../environments/environment';
import { SnackbarService } from '../../core/services/snackbar.service';
import { ModalService } from '../../core/services/modal.service';

interface Policy {
  id: string;
  name: string;
  type: 'budget' | 'model_routing' | 'tool' | 'data_handling';
  enabled: boolean;
  config: any;
  created_at: string;
  updated_at: string;
}

interface PolicyFormData {
  name: string;
  type: Policy['type'];
  config: any;
}

interface SimulateRequest {
  promptLength: number;
  path: 'code' | 'talk';
  model?: string;
  provider?: string;
}

@Component({
  selector: 'app-policies',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatSelectModule,
    MatFormFieldModule,
  ],
  templateUrl: './policies.page.html',
  styleUrls: ['./policies.page.scss'],
})
export class PoliciesPage implements OnInit {
  policies: Policy[] = [];
  loading = false;
  error: string | null = null;
  showCreateForm = false;
  selectedPolicyType: Policy['type'] | null = null;
  
  // Form data
  policyForm: PolicyFormData = {
    name: '',
    type: 'budget',
    config: {},
  };
  
  // Simulate form
  simulatePromptLength = 1000;
  simulatePath: 'code' | 'talk' = 'code';
  simulating = false;

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private snackbarService: SnackbarService,
    private modalService: ModalService
  ) {}

  async ngOnInit() {
    await this.loadPolicies();
  }

  async loadPolicies() {
    this.loading = true;
    this.error = null;

    try {
      const policies = await firstValueFrom(this.http.get<Policy[]>(`${environment.apiUrl}/policies`));
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
    this.policyForm = {
      name: '',
      type,
      config: this.getDefaultConfig(type),
    };
    this.showCreateForm = true;
  }

  getDefaultConfig(type: Policy['type']): any {
    switch (type) {
      case 'budget':
        return {
          maxDailyUsd: 100,
          maxMonthlyUsd: 3000,
          maxPerRunUsd: 5,
          scope: 'org', // org | project | run
        };
      case 'model_routing':
        return {
          allowedModels: [],
          deniedModels: [],
          allowedProviders: [],
          deniedProviders: [],
        };
      case 'tool':
        return {
          allowedTools: [],
          deniedTools: [],
          denyBashPatterns: [],
          filesystemScope: 'project', // project | repo | unrestricted
        };
      case 'data_handling':
        return {
          allowPromptTransmission: false,
          allowEventTransmission: true,
          retentionDays: 30,
        };
      default:
        return {};
    }
  }

  getPolicyTypeLabel(type: Policy['type']): string {
    const labels: Record<Policy['type'], string> = {
      budget: 'Budget Policy',
      model_routing: 'Model Routing',
      tool: 'Tool Policy',
      data_handling: 'Data Handling',
    };
    return labels[type] || type;
  }

  async savePolicy() {
    if (!this.policyForm.name.trim()) {
      this.snackbarService.showError('Policy name is required');
      return;
    }

    try {
      const newPolicy = await firstValueFrom(this.http
        .post<Policy>(`${environment.apiUrl}/policies`, {
          name: this.policyForm.name,
          type: this.policyForm.type,
          config: this.policyForm.config,
        }));

      this.snackbarService.showSuccess('Policy created successfully');
      this.closeCreateForm();
      await this.loadPolicies();
    } catch (err: any) {
      this.snackbarService.showError(err.error?.error || 'Failed to create policy');
    }
  }

  closeCreateForm() {
    this.showCreateForm = false;
    this.selectedPolicyType = null;
    this.policyForm = {
      name: '',
      type: 'budget',
      config: {},
    };
  }

  async simulateDecision() {
    this.simulating = true;
    try {
      const result = await firstValueFrom(this.http
        .post<any>(`${environment.apiUrl}/policies/simulate`, {
          promptLength: this.simulatePromptLength,
          path: this.simulatePath,
        }));

      // Show results in modal
      const resultText = `Policy Decision Simulation\n\n` +
        `Input:\n` +
        `Prompt Length: ${this.simulatePromptLength} chars\n` +
        `Path: ${this.simulatePath}\n\n` +
        `Result:\n` +
        `${result.decision || 'No policies matched'}\n` +
        (result.reasons ? `\nReasons:\n${result.reasons.join('\n')}` : '');

      this.modalService.showInfo('Simulation Results', resultText).subscribe();
    } catch (err: any) {
      if (err.status === 404) {
        // Endpoint doesn't exist yet - show mock result
        this.modalService.showInfo(
          'Simulation Results (Mock)',
          `This would simulate how policies apply to a ${this.simulatePath} prompt of ${this.simulatePromptLength} characters. The simulate endpoint is not yet implemented in the backend.`
        ).subscribe();
      } else {
        this.snackbarService.showError(err.error?.error || 'Failed to simulate policy decision');
      }
    } finally {
      this.simulating = false;
    }
  }

  updateModelList(type: 'allowed' | 'denied') {
    const field = type === 'allowed' ? 'allowedModelsStr' : 'deniedModelsStr';
    const arrayField = type === 'allowed' ? 'allowedModels' : 'deniedModels';
    const str = this.policyForm.config[field] || '';
    this.policyForm.config[arrayField] = str
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  }

  updateProviderList(type: 'allowed' | 'denied') {
    const field = type === 'allowed' ? 'allowedProvidersStr' : 'deniedProvidersStr';
    const arrayField = type === 'allowed' ? 'allowedProviders' : 'deniedProviders';
    const str = this.policyForm.config[field] || '';
    this.policyForm.config[arrayField] = str
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  }

  updateToolList(type: 'allowed' | 'denied') {
    const field = type === 'allowed' ? 'allowedToolsStr' : 'deniedToolsStr';
    const arrayField = type === 'allowed' ? 'allowedTools' : 'deniedTools';
    const str = this.policyForm.config[field] || '';
    this.policyForm.config[arrayField] = str
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }
}
