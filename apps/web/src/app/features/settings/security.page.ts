import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService, OrgSettings } from '../../core/api/settings.service';
import { SupabaseService } from '../../services/supabase.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { MeService } from '../../core/services/me.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-security-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './security.page.html',
  styleUrls: ['./security.page.scss'],
})
export class SecuritySettingsPage implements OnInit {
  orgId: string | null = null;
  settings: OrgSettings | null = null;
  loading = false;
  saving = false;
  error: string | null = null;

  // Form fields
  dataRetentionDays = 30;
  storePrompts = false;
  storeResponses = false;
  storeInternalDebug = false;
  allowSemanticCache = true;
  enforceSso = false;
  allowedEmailDomains: string = '';
  providerKeyMode: 'BYOK_ONLY' | 'VAULT_ONLY' | 'EITHER' = 'EITHER';
  allowedIpRanges: string = '';

  constructor(
    private settingsService: SettingsService,
    private supabase: SupabaseService,
    private snackbar: SnackbarService,
    private http: HttpClient
  ) {}

  async ngOnInit() {
    await this.loadOrgId();
    if (this.orgId) {
      await this.loadSettings();
    }
  }

  async loadOrgId() {
    try {
      const me = await this.meService.getMe().toPromise();
      if (me && me.org) {
        this.orgId = me.org.id;
      }
    } catch (err) {
      this.error = 'Failed to load organization';
    }
  }

  async loadSettings() {
    if (!this.orgId) return;

    this.loading = true;
    this.error = null;

    try {
      this.settings = await this.settingsService.getOrgSettings(this.orgId).toPromise() || null;
      
      if (this.settings) {
        this.dataRetentionDays = this.settings.data_retention_days;
        this.storePrompts = this.settings.store_prompts;
        this.storeResponses = this.settings.store_responses;
        this.storeInternalDebug = this.settings.store_internal_debug;
        this.allowSemanticCache = this.settings.allow_semantic_cache;
        this.enforceSso = this.settings.enforce_sso;
        this.allowedEmailDomains = (this.settings.allowed_email_domains || []).join(', ');
        this.providerKeyMode = this.settings.provider_key_mode;
        this.allowedIpRanges = (this.settings.allowed_ip_ranges || []).join(', ');
      }
    } catch (err: any) {
      this.error = err.error?.error || 'Failed to load settings';
    } finally {
      this.loading = false;
    }
  }

  async saveSettings() {
    if (!this.orgId) return;

    this.saving = true;
    this.error = null;

    try {
      const updates: Partial<OrgSettings> = {
        data_retention_days: this.dataRetentionDays,
        store_prompts: this.storePrompts,
        store_responses: this.storeResponses,
        store_internal_debug: this.storeInternalDebug,
        allow_semantic_cache: this.allowSemanticCache,
        enforce_sso: this.enforceSso,
        allowed_email_domains: this.allowedEmailDomains
          .split(',')
          .map(d => d.trim())
          .filter(d => d.length > 0),
        provider_key_mode: this.providerKeyMode,
        allowed_ip_ranges: this.allowedIpRanges
          .split(',')
          .map(r => r.trim())
          .filter(r => r.length > 0),
      };

      // Convert empty arrays to null
      if (updates.allowed_email_domains?.length === 0) {
        updates.allowed_email_domains = null;
      }
      if (updates.allowed_ip_ranges?.length === 0) {
        updates.allowed_ip_ranges = null;
      }

      await this.settingsService.updateOrgSettings(this.orgId, updates).toPromise();
      this.snackbar.showSuccess('Settings saved successfully');
      await this.loadSettings();
    } catch (err: any) {
      this.error = err.error?.error || 'Failed to save settings';
      this.snackbar.showError(this.error || 'An error occurred');
    } finally {
      this.saving = false;
    }
  }
}
