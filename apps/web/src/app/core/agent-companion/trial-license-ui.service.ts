import { Injectable } from '@angular/core';

/** Optional ISO date — set by Desktop or tests; cloud org trial can be merged later. */
const TRIAL_ENDS_LS = 'spectyra.local_trial_ends_at';

export type MetricsPresentation = 'actual' | 'projected';

export interface LiveProductTopline {
  /** Companion reachable and monitoring not disabled. */
  spectyraMonitoring: boolean;
  /** runMode from companion. */
  runMode: string;
  /** From companion /health. */
  licenseAllowsFullOptimization: boolean;
  /** When true, savings numbers are realized (not dry-run / not license-limited observe). */
  metricsPresentation: MetricsPresentation;
  /** Short label for the top bar. */
  optimizationHeadline: string;
  /** Trial badge copy, or null. */
  trialBadge: 'Trial Active' | 'Trial Ended' | null;
  /** Subtle line e.g. post-trial observe. */
  trustLine: string;
}

/**
 * Maps companion /health + local trial hint into consistent UI labels (spec §7, §13).
 */
@Injectable({ providedIn: 'root' })
export class TrialLicenseUiService {
  /** Persist 7-day trial end when Desktop or shell sets it (ISO string). */
  setLocalTrialEndsAt(iso: string | null): void {
    if (typeof localStorage === 'undefined') return;
    if (iso) localStorage.setItem(TRIAL_ENDS_LS, iso);
    else localStorage.removeItem(TRIAL_ENDS_LS);
  }

  getLocalTrialEndsAt(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(TRIAL_ENDS_LS);
  }

  computeTopline(health: Record<string, unknown> | null): LiveProductTopline {
    const runMode = String(health?.['runMode'] ?? 'on');
    const lic = health?.['licenseAllowsFullOptimization'] === true;
    const monitoring =
      health?.['monitoringEnabled'] !== false && health?.['telemetryMode'] !== 'off';

    const realized = runMode === 'on' && lic;
    const metricsPresentation: MetricsPresentation = realized ? 'actual' : 'projected';

    let optimizationHeadline = 'Optimization ON';
    if (runMode === 'off') optimizationHeadline = 'Optimization off';
    else if (!lic || runMode === 'observe') optimizationHeadline = 'Observe only';

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
        'Spectyra is monitoring and showing projected savings. Add a valid license and keep run mode on to realize savings.';
    }

    return {
      spectyraMonitoring: !!health && monitoring,
      runMode,
      licenseAllowsFullOptimization: lic,
      metricsPresentation,
      optimizationHeadline,
      trialBadge,
      trustLine,
    };
  }
}
