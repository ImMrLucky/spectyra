import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { AdminService } from '../../core/api/admin.service';

/** Bundled snapshot shape from `GET /v1/admin/pricing/snapshot` (camelCase). */
export interface AdminPricingSnapshot {
  version: string;
  createdAt: string;
  currency: string;
  ttlSeconds: number;
  entries: AdminPricingModelRow[];
}

export interface AdminPricingModelRow {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  sourceUrl?: string;
  sourceLabel?: string;
  sourceFetchedAt?: string;
  components: Array<{ key: string; label?: string; price: number; unit: string; currency?: string }>;
}

export interface AdminPricingOverrideRow {
  id: string;
  org_id: string | null;
  model_id: string;
  patch_json: Record<string, unknown>;
  updated_at: string;
}

@Component({
  selector: 'app-admin-pricing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIcon],
  templateUrl: './admin-pricing.page.html',
  styleUrls: ['./admin-pricing.page.scss'],
})
export class AdminPricingPage implements OnInit {
  loading = false;
  error: string | null = null;
  snapshot: AdminPricingSnapshot | null = null;
  /** From API `registry` — database row TTL vs age. */
  catalogStale = false;
  catalogSource: string | null = null;
  registryIngestedAt: string | null = null;
  overrideCount: number | null = null;
  providerFilter = '';

  overrides: AdminPricingOverrideRow[] = [];
  loadingOverrides = false;
  overrideOrgId = '';
  overrideModelId = '';
  overridePatchJson = '{"components":[{"key":"input_tokens","price":0.2,"unit":"per_1m_tokens","currency":"USD","label":"Input"}]}';
  savingOverride = false;
  ingesting = false;

  constructor(private admin: AdminService) {}

  ngOnInit(): void {
    this.load();
    this.loadOverrides();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    const p = this.providerFilter.trim().toLowerCase() || undefined;
    this.admin.getPricingSnapshot(p).subscribe({
      next: res => {
        this.snapshot = res.snapshot as unknown as AdminPricingSnapshot;
        this.catalogStale = Boolean(res.registry?.stale);
        this.catalogSource = res.registry?.source ?? null;
        this.registryIngestedAt = res.registry?.ingestedAt ?? null;
        this.overrideCount =
          typeof res.registry?.overrideCount === 'number' ? res.registry.overrideCount : null;
        this.loading = false;
      },
      error: err => {
        this.error = err?.error?.error ?? err?.message ?? 'Failed to load pricing snapshot';
        this.loading = false;
      },
    });
  }

  loadOverrides(): void {
    this.loadingOverrides = true;
    this.admin.listPricingOverrides().subscribe({
      next: res => {
        this.overrides = (res.overrides ?? []).map(o => ({
          ...o,
          patch_json: (o.patch_json ?? {}) as Record<string, unknown>,
        }));
        this.loadingOverrides = false;
      },
      error: () => {
        this.loadingOverrides = false;
      },
    });
  }

  ingestBundled(): void {
    this.ingesting = true;
    this.error = null;
    this.admin.ingestBundledPricing().subscribe({
      next: () => {
        this.ingesting = false;
        this.load();
        this.loadOverrides();
      },
      error: err => {
        this.ingesting = false;
        this.error = err?.error?.error ?? err?.message ?? 'Ingest failed';
      },
    });
  }

  saveOverride(): void {
    const modelId = this.overrideModelId.trim();
    if (!modelId) {
      this.error = 'modelId is required';
      return;
    }
    let patch: Record<string, unknown>;
    try {
      patch = JSON.parse(this.overridePatchJson) as Record<string, unknown>;
    } catch {
      this.error = 'Patch must be valid JSON';
      return;
    }
    const orgRaw = this.overrideOrgId.trim();
    const orgId = orgRaw === '' ? null : orgRaw;
    this.savingOverride = true;
    this.error = null;
    this.admin.upsertPricingOverride({ orgId, modelId, patch }).subscribe({
      next: () => {
        this.savingOverride = false;
        this.loadOverrides();
        this.load();
      },
      error: err => {
        this.savingOverride = false;
        this.error = err?.error?.error ?? err?.message ?? 'Save override failed';
      },
    });
  }

  deleteOverride(id: string): void {
    this.admin.deletePricingOverride(id).subscribe({
      next: () => {
        this.loadOverrides();
        this.load();
      },
      error: err => {
        this.error = err?.error?.error ?? err?.message ?? 'Delete failed';
      },
    });
  }
}
