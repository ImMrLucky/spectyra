import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProviderKeysService, ProviderCredential, ProviderKeyMode } from '../../core/api/provider-keys.service';
import { SupabaseService } from '../../services/supabase.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-provider-keys',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './provider-keys.page.html',
  styleUrls: ['./provider-keys.page.scss'],
})
export class ProviderKeysPage implements OnInit {
  orgId: string | null = null;
  credentials: ProviderCredential[] = [];
  providerKeyMode: 'BYOK_ONLY' | 'VAULT_ONLY' | 'EITHER' = 'EITHER';
  
  loading = false;
  saving = false;
  revoking: string | null = null;
  error: string | null = null;
  
  // Add key form
  showAddForm = false;
  selectedProvider: 'openai' | 'anthropic' | 'google' | 'azure' | 'aws' = 'openai';
  providerKey = '';
  selectedProjectId: string | null = null;
  projects: Array<{ id: string; name: string }> = [];

  constructor(
    private providerKeysService: ProviderKeysService,
    private supabase: SupabaseService,
    private snackbar: SnackbarService,
    private http: HttpClient
  ) {}

  async ngOnInit() {
    await this.loadOrgId();
    if (this.orgId) {
      await Promise.all([
        this.loadCredentials(),
        this.loadProviderKeyMode(),
        this.loadProjects(),
      ]);
    }
  }

  async loadOrgId() {
    try {
      const me = await this.http.get<any>(`${environment.apiUrl}/auth/me`).toPromise();
      if (me && me.org) {
        this.orgId = me.org.id;
      }
    } catch (err) {
      this.error = 'Failed to load organization';
    }
  }

  async loadProjects() {
    try {
      const me = await this.http.get<any>(`${environment.apiUrl}/auth/me`).toPromise();
      if (me && me.projects) {
        this.projects = me.projects;
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  }

  async loadCredentials() {
    if (!this.orgId) return;

    this.loading = true;
    this.error = null;

    try {
      this.credentials = await this.providerKeysService.listProviderKeys(this.orgId).toPromise() || [];
    } catch (err: any) {
      this.error = err.error?.error || 'Failed to load provider keys';
    } finally {
      this.loading = false;
    }
  }

  async loadProviderKeyMode() {
    if (!this.orgId) return;

    try {
      const mode = await this.providerKeysService.getProviderKeyMode(this.orgId).toPromise();
      if (mode) {
        this.providerKeyMode = mode.provider_key_mode;
      }
    } catch (err) {
      console.error('Failed to load provider key mode:', err);
    }
  }

  async addProviderKey() {
    if (!this.orgId || !this.providerKey.trim()) {
      this.error = 'Provider key is required';
      return;
    }

    this.saving = true;
    this.error = null;

    try {
      await this.providerKeysService.setProviderKey(
        this.orgId,
        this.selectedProvider,
        this.providerKey.trim(),
        this.selectedProjectId || null
      ).toPromise();

      this.snackbar.showSuccess('Provider key saved successfully');
      this.showAddForm = false;
      this.providerKey = '';
      this.selectedProjectId = null;
      await this.loadCredentials();
    } catch (err: any) {
      this.error = err.error?.error || 'Failed to save provider key';
      this.snackbar.showError(this.error || 'An error occurred');
    } finally {
      this.saving = false;
    }
  }

  async revokeCredential(credentialId: string) {
    if (!this.orgId) return;
    if (!confirm('Are you sure you want to revoke this provider key? This action cannot be undone.')) {
      return;
    }

    this.revoking = credentialId;
    this.error = null;

    try {
      await this.providerKeysService.revokeProviderKey(this.orgId, credentialId).toPromise();
      this.snackbar.showSuccess('Provider key revoked');
      await this.loadCredentials();
    } catch (err: any) {
      this.error = err.error?.error || 'Failed to revoke provider key';
      this.snackbar.showError(this.error || 'An error occurred');
    } finally {
      this.revoking = null;
    }
  }

  async updateProviderKeyMode() {
    if (!this.orgId) return;

    this.saving = true;
    this.error = null;

    try {
      await this.providerKeysService.updateProviderKeyMode(this.orgId, this.providerKeyMode).toPromise();
      this.snackbar.showSuccess('Provider key mode updated');
    } catch (err: any) {
      this.error = err.error?.error || 'Failed to update provider key mode';
      this.snackbar.showError(this.error || 'An error occurred');
    } finally {
      this.saving = false;
    }
  }

  getProviderLabel(provider: string): string {
    const labels: { [key: string]: string } = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      google: 'Google',
      azure: 'Azure OpenAI',
      aws: 'AWS Bedrock',
    };
    return labels[provider] || provider;
  }

  maskFingerprint(fingerprint: string): string {
    if (fingerprint.length <= 8) return fingerprint;
    return fingerprint.substring(0, 4) + '...' + fingerprint.substring(fingerprint.length - 4);
  }
}
