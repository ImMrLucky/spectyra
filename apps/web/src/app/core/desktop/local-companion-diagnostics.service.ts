import { Injectable } from '@angular/core';
import {
  OPENCLAW_INSTALL_GUIDE,
  deriveSpectyraLocalConnectionState,
  generateOpenClawConfigString,
  runLocalCompanionDiagnostics,
  type OpenClawWizardStatus,
} from '@spectyra/openclaw-bridge';
import { CompanionAnalyticsService } from '../analytics/companion-analytics.service';

/**
 * Thin facade over `@spectyra/openclaw-bridge` using the resolved Local Companion origin
 * (Electron port-aware via {@link CompanionAnalyticsService}).
 */
@Injectable({ providedIn: 'root' })
export class LocalCompanionDiagnosticsService {
  readonly installGuide = OPENCLAW_INSTALL_GUIDE;

  constructor(private readonly companion: CompanionAnalyticsService) {}

  async runDiagnostics(): Promise<OpenClawWizardStatus> {
    const origin = await this.companion.resolveCompanionOrigin();
    return runLocalCompanionDiagnostics(origin);
  }

  async buildOpenClawConfigJson(): Promise<string> {
    const origin = await this.companion.resolveCompanionOrigin();
    return generateOpenClawConfigString({ baseUrl: `${origin}/v1` });
  }

  connectionState(status: OpenClawWizardStatus, signedIn?: boolean) {
    return deriveSpectyraLocalConnectionState(status.health, { signedIn });
  }
}
