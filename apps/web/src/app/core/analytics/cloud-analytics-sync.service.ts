import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { sessionToSyncedPayload } from '@spectyra/analytics-core';
import type { SessionAnalyticsRecord } from '@spectyra/analytics-core';
import { SupabaseService } from '../../services/supabase.service';

/**
 * Uploads **redacted session summaries** to Spectyra API when the user enables sync and is signed in.
 * Never sends raw prompts, tool output, or provider keys.
 */
@Injectable({ providedIn: 'root' })
export class CloudAnalyticsSyncService {
  lastError: string | null = null;
  lastSyncedAt: string | null = null;

  constructor(
    private http: HttpClient,
    private supabase: SupabaseService,
  ) {}

  /** True if we can attach auth (Supabase JWT) to API calls. */
  async canSync(): Promise<boolean> {
    const t = await this.supabase.getAccessToken();
    return !!t;
  }

  async syncSessionSummary(session: SessionAnalyticsRecord): Promise<boolean> {
    this.lastError = null;
    const token = await this.supabase.getAccessToken();
    if (!token) {
      this.lastError = 'Sign in to sync analytics to your account.';
      return false;
    }
    const payload = sessionToSyncedPayload(session);
    try {
      await firstValueFrom(
        this.http.post<{ ok: boolean }>(`${environment.apiUrl}/analytics/sessions`, payload),
      );
      this.lastSyncedAt = new Date().toISOString();
      return true;
    } catch (e: unknown) {
      const err = e as { error?: { error?: string }; message?: string };
      this.lastError = err?.error?.error || err?.message || 'Sync failed';
      return false;
    }
  }
}
