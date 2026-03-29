import { Injectable } from '@angular/core';

const TRIAL_ENDS_LS = 'spectyra.local_trial_ends_at';
const TRIAL_STARTED_LS = 'spectyra.local_trial_started';
const TRIAL_DAYS = 7;

export type MetricsPresentation = 'actual' | 'projected';

export interface LiveProductTopline {
  spectyraMonitoring: boolean;
  runMode: string;
  licenseAllowsFullOptimization: boolean;
  metricsPresentation: MetricsPresentation;
  optimizationHeadline: string;
  trialBadge: 'Trial Active' | 'Trial Ended' | null;
  trustLine: string;
  trialDaysLeft: number | null;
  trialActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class TrialLicenseUiService {

  setLocalTrialEndsAt(iso: string | null): void {
    if (typeof localStorage === 'undefined') return;
    if (iso) localStorage.setItem(TRIAL_ENDS_LS, iso);
    else localStorage.removeItem(TRIAL_ENDS_LS);
  }

  getLocalTrialEndsAt(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(TRIAL_ENDS_LS);
  }

  ensureTrialStarted(): void {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(TRIAL_STARTED_LS)) return;
    const end = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();
    this.setLocalTrialEndsAt(end);
    localStorage.setItem(TRIAL_STARTED_LS, new Date().toISOString());
  }

  trialDaysRemaining(): number | null {
    const end = this.getLocalTrialEndsAt();
    if (!end) return null;
    const ms = Date.parse(end) - Date.now();
    if (Number.isNaN(ms)) return null;
    return Math.max(0, Math.ceil(ms / 86400000));
  }

  isTrialActive(): boolean {
    const days = this.trialDaysRemaining();
    return days !== null && days > 0;
  }

  computeTopline(health: Record<string, unknown> | null): LiveProductTopline {
    this.ensureTrialStarted();

    const runMode = String(health?.['runMode'] ?? 'on');
    const lic = health?.['licenseAllowsFullOptimization'] === true;
    const monitoring =
      health?.['monitoringEnabled'] !== false && health?.['telemetryMode'] !== 'off';

    const trialActive = this.isTrialActive();
    const trialDaysLeft = this.trialDaysRemaining();
    const effectiveLic = lic || trialActive;
    const realized = runMode === 'on' && effectiveLic;
    const metricsPresentation: MetricsPresentation = realized ? 'actual' : 'projected';

    let optimizationHeadline = 'Optimization ON';
    if (runMode === 'off') optimizationHeadline = 'Optimization off';
    else if (!effectiveLic || runMode === 'observe') optimizationHeadline = 'Observe only';

    const trialEnd = this.getLocalTrialEndsAt();
    let trialBadge: LiveProductTopline['trialBadge'] = null;
    if (trialEnd) {
      const end = Date.parse(trialEnd);
      if (!Number.isNaN(end)) {
        trialBadge = Date.now() < end ? 'Trial Active' : 'Trial Ended';
      }
    }

    let trustLine =
      'Your agent keeps working — Spectyra never blocks the underlying provider call when optimization is off.';
    if (!realized && runMode !== 'off') {
      trustLine =
        'Spectyra is monitoring and showing projected savings. Upgrade or add a valid license to realize savings.';
    }
    if (trialActive && !lic) {
      trustLine = `Trial active — ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining. Full optimization enabled.`;
    }

    return {
      spectyraMonitoring: !!health && monitoring,
      runMode,
      licenseAllowsFullOptimization: effectiveLic,
      metricsPresentation,
      optimizationHeadline,
      trialBadge,
      trustLine,
      trialDaysLeft,
      trialActive,
    };
  }
}
