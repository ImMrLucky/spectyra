import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, take } from 'rxjs';
import { generateOpenClawConfigString } from '@spectyra/openclaw-bridge';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { CompanionAnalyticsService } from '../../../core/analytics/companion-analytics.service';
import { DesktopBridgeService } from '../../../core/desktop/desktop-bridge.service';
import type {
  IntegrationDiagnostics,
  OnboardingActionType,
  OnboardingStateInput,
  OnboardingStatus,
} from '../models/integration-onboarding.types';
import { buildOnboardingStatus, resolveOnboardingState } from './map-onboarding-state';

const LS_DESKTOP_ACK = 'spectyra_onboarding_desktop_ack';

@Injectable({ providedIn: 'root' })
export class IntegrationOnboardingService {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly companion = inject(CompanionAnalyticsService);
  private readonly desktop = inject(DesktopBridgeService);

  /** Current onboarding machine state + actions. */
  readonly status = signal<OnboardingStatus>(this.checkingStatus());

  /** Last full diagnostics payload (for drawer). */
  readonly lastDiagnostics = signal<IntegrationDiagnostics | null>(null);

  readonly lastRefreshAt = signal<Date | null>(null);

  /** Set from route query e.g. `?from=clawhub` — skips “OpenClaw not installed” detection gap. */
  assumeOpenClawFromFlow = false;

  private checkingStatus(): OnboardingStatus {
    return buildOnboardingStatus(
      'checking',
      {
        desktopInstalled: false,
        companionRunning: false,
        signedIn: false,
        providerConfigured: false,
        openclawDetected: false,
        openclawConnected: false,
      },
      'Checking your local setup…',
    );
  }

  acknowledgeDesktopInstalled(): void {
    try {
      localStorage.setItem(LS_DESKTOP_ACK, '1');
    } catch {
      /* ignore */
    }
    void this.refreshOpenClawStatus();
  }

  hasDesktopAckFromStorage(): boolean {
    try {
      return localStorage.getItem(LS_DESKTOP_ACK) === '1';
    } catch {
      return false;
    }
  }

  async refreshOpenClawStatus(): Promise<void> {
    this.status.set(this.checkingStatus());
    const authSnap = await firstValueFrom(this.auth.authState.pipe(take(1)));
    const errors: string[] = [];
    let companionRunning = false;
    let providerConfigured = false;
    let mode: 'off' | 'observe' | 'on' | undefined;
    let companionBaseUrl: string | undefined;
    let modelAliases: string[] | undefined;
    let openclawDetected = false;
    let openclawConnected = false;
    let desktopInstalled = environment.isDesktop;
    let signedIn =
      environment.isDesktop ? true : !!(authSnap.user && authSnap.hasAccess);
    let openclawCli = false;

    const origin = await this.companion.resolveCompanionOrigin();
    companionBaseUrl = origin;

    try {
      if (this.desktop.isElectronRenderer && typeof window !== 'undefined' && window.spectyra?.openclaw?.detectCli) {
        const r = await window.spectyra.openclaw.detectCli!();
        openclawCli = r?.available === true;
      }
    } catch {
      /* ignore */
    }

    try {
      const [rs, ro] = await Promise.all([
        fetch(`${origin}/diagnostics/status`, { signal: AbortSignal.timeout(8000) }),
        fetch(`${origin}/diagnostics/integrations/openclaw`, { signal: AbortSignal.timeout(8000) }),
      ]);

      companionRunning = rs.ok;
      if (rs.ok) {
        const j = (await rs.json()) as Record<string, unknown>;
        if (typeof j['desktopInstalled'] === 'boolean') {
          desktopInstalled = desktopInstalled || (j['desktopInstalled'] as boolean);
        }
        if (typeof j['signedIn'] === 'boolean') {
          signedIn = signedIn || (j['signedIn'] as boolean);
        }
        providerConfigured = j['providerConfigured'] === true;
        const m = j['mode'];
        if (m === 'off' || m === 'observe' || m === 'on') mode = m;
        if (typeof j['companionBaseUrl'] === 'string') companionBaseUrl = j['companionBaseUrl'] as string;
        if (Array.isArray(j['modelAliases'])) {
          modelAliases = (j['modelAliases'] as unknown[]).filter((x): x is string => typeof x === 'string');
        }
      } else {
        errors.push(`diagnostics/status HTTP ${rs.status}`);
      }

      if (ro.ok) {
        const o = (await ro.json()) as {
          detected?: boolean;
          connected?: boolean;
        };
        openclawDetected = o.detected === true || openclawCli;
        openclawConnected = o.connected === true;
      } else {
        errors.push(`diagnostics/integrations/openclaw HTTP ${ro.status}`);
      }
    } catch (e) {
      companionRunning = false;
      errors.push(e instanceof Error ? e.message : String(e));
    }

    if (!environment.isDesktop) {
      desktopInstalled = desktopInstalled || this.hasDesktopAckFromStorage();
    }

    if (this.assumeOpenClawFromFlow) {
      openclawDetected = true;
    }

    const input: OnboardingStateInput = {
      isDesktopApp: environment.isDesktop,
      userAcknowledgedDesktopInstall: this.hasDesktopAckFromStorage(),
      assumeOpenClawFromFlow: this.assumeOpenClawFromFlow,
      companionRunning,
      signedIn,
      providerConfigured,
      openclawDetectedFromRuntime: openclawDetected,
      openclawConnectedFromRuntime: openclawConnected,
      errorMessage: undefined,
    };

    const state = resolveOnboardingState(input);

    const diag: IntegrationDiagnostics = {
      desktopInstalled,
      companionRunning,
      signedIn,
      providerConfigured,
      integrationDetected: openclawDetected,
      integrationConnected: openclawConnected,
      mode,
      companionBaseUrl,
      modelAliases,
      errors: errors.length ? errors : undefined,
    };
    this.lastDiagnostics.set(diag);
    this.lastRefreshAt.set(new Date());

    this.status.set(
      buildOnboardingStatus(state, {
        desktopInstalled,
        companionRunning,
        signedIn,
        providerConfigured,
        openclawDetected,
        openclawConnected,
        mode,
        companionBaseUrl,
        modelAliases,
      }),
    );
  }

  async runDiagnostics(): Promise<IntegrationDiagnostics> {
    await this.refreshOpenClawStatus();
    return this.lastDiagnostics() ?? {
      desktopInstalled: false,
      companionRunning: false,
      signedIn: false,
      providerConfigured: false,
      integrationDetected: false,
      integrationConnected: false,
    };
  }

  async copyOpenClawConfig(): Promise<void> {
    const origin = await this.companion.resolveCompanionOrigin();
    const json = generateOpenClawConfigString({ baseUrl: `${origin}/v1` });
    await navigator.clipboard.writeText(json);
  }

  async openDesktopApp(): Promise<void> {
    if (typeof window !== 'undefined') window.focus();
  }

  async openDownloadPage(): Promise<void> {
    await this.router.navigate(['/download']);
  }

  async navigateSignIn(): Promise<void> {
    await this.router.navigate(['/login']);
  }

  async navigateProviderSettings(): Promise<void> {
    if (environment.isDesktop) {
      await this.router.navigate(['/desktop/settings']);
    } else {
      await this.router.navigate(['/settings/provider-keys']);
    }
  }

  /** Lightweight connectivity test (no prompt body to provider). */
  async runTestRequest(): Promise<{ ok: boolean; detail?: string }> {
    const origin = await this.companion.resolveCompanionOrigin();
    try {
      const r = await fetch(`${origin}/v1/models`, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` };
      return { ok: true, detail: 'Local Companion models endpoint responded.' };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  }

  async executeAction(type: OnboardingActionType): Promise<void> {
    switch (type) {
      case 'download_desktop':
        await this.openDownloadPage();
        break;
      case 'open_desktop':
        await this.openDesktopApp();
        break;
      case 'sign_in':
        await this.navigateSignIn();
        break;
      case 'configure_provider':
        await this.navigateProviderSettings();
        break;
      case 'copy_openclaw_config':
        await this.copyOpenClawConfig();
        break;
      case 'run_diagnostics':
        await this.runDiagnostics();
        break;
      case 'retry':
        if (this.status().state === 'desktop_not_installed') {
          this.acknowledgeDesktopInstalled();
        } else {
          await this.refreshOpenClawStatus();
        }
        break;
      case 'run_test':
        await this.runTestRequest();
        break;
      default:
        break;
    }
  }
}
