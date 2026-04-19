import { Injectable } from '@angular/core';

export type MetricsPresentation = 'actual' | 'projected';

export interface LiveProductTopline {
  spectyraMonitoring: boolean;
  runMode: string;
  licenseAllowsFullOptimization: boolean;
  metricsPresentation: MetricsPresentation;
  optimizationHeadline: string;
  trialBadge: null;
  trustLine: string;
  trialDaysLeft: null;
  trialActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class TrialLicenseUiService {
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

    let trustLine =
      'Your agent keeps working — Spectyra never blocks the underlying provider call when optimization is off.';
    if (!realized && runMode !== 'off') {
      trustLine =
        'Spectyra is monitoring and showing projected savings. Add a valid license or upgrade your org to realize savings.';
    }

    return {
      spectyraMonitoring: !!health && monitoring,
      runMode,
      licenseAllowsFullOptimization: lic,
      metricsPresentation,
      optimizationHeadline,
      trialBadge: null,
      trustLine,
      trialDaysLeft: null,
      trialActive: false,
    };
  }
}
