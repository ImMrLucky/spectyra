import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, take } from 'rxjs';
import { generateOpenClawConfigString } from '@spectyra/openclaw-bridge';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { supabase } from '../../../core/supabase/supabase.client';
import { CompanionAnalyticsService } from '../../../core/analytics/companion-analytics.service';
import { DesktopBridgeService } from '../../../core/desktop/desktop-bridge.service';
import type { CompanionSetupStatusIpc } from '../../../../spectyra-window';
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

  /** True while Electron is (re)starting the companion and waiting for /health (can take several seconds). */
  readonly companionStartBusy = signal(false);

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
      { isDesktop: environment.isDesktop },
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
    /**
     * Web: Spectyra API session from AuthService.
     * Desktop: AuthService always injects a local placeholder user — use Supabase session for a real account.
     */
    let signedIn = !!(authSnap.user && authSnap.hasAccess);
    if (environment.isDesktop) {
      try {
        const { data: s } = await supabase.auth.getSession();
        signedIn = !!s.session?.user;
      } catch {
        signedIn = false;
      }
    }
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
      const useMainProcessDiagnostics =
        environment.isDesktop &&
        typeof window !== 'undefined' &&
        typeof window.spectyra?.companion?.getSetupStatus === 'function';

      if (useMainProcessDiagnostics) {
        const ipc = await window.spectyra!.companion.getSetupStatus!();
        const merged = this.mergeCompanionSetupFromIpc(ipc, openclawCli, desktopInstalled);
        companionRunning = merged.companionRunning;
        desktopInstalled = merged.desktopInstalled;
        providerConfigured = merged.providerConfigured;
        mode = merged.mode;
        companionBaseUrl = merged.companionBaseUrl;
        modelAliases = merged.modelAliases;
        openclawDetected = merged.openclawDetected;
        openclawConnected = merged.openclawConnected;
        errors.push(...merged.extraErrors);
      } else {
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
      buildOnboardingStatus(
        state,
        {
          desktopInstalled,
          companionRunning,
          signedIn,
          providerConfigured,
          openclawDetected,
          openclawConnected,
          mode,
          companionBaseUrl,
          modelAliases,
        },
        undefined,
        { isDesktop: environment.isDesktop },
      ),
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
    const canStartCompanion =
      environment.isDesktop &&
      typeof window !== 'undefined' &&
      !!window.spectyra?.companion?.start;

    if (canStartCompanion) {
      this.companionStartBusy.set(true);
      try {
        try {
          const result = await window.spectyra!.companion.start();
          if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
            console.warn('[integration-onboarding] companion.start:', result);
          }
        } catch (e) {
          console.error('[integration-onboarding] companion.start failed', e);
        }
        await this.waitForCompanionHealthFromMain(22_000);
        await this.refreshOpenClawStatus();
      } finally {
        this.companionStartBusy.set(false);
      }
      return;
    }
    if (typeof window !== 'undefined') window.focus();
  }

  private mergeCompanionSetupFromIpc(
    ipc: CompanionSetupStatusIpc,
    openclawCli: boolean,
    desktopInstalledIn: boolean,
  ): {
    companionRunning: boolean;
    desktopInstalled: boolean;
    providerConfigured: boolean;
    mode?: 'off' | 'observe' | 'on';
    companionBaseUrl?: string;
    modelAliases?: string[];
    openclawDetected: boolean;
    openclawConnected: boolean;
    extraErrors: string[];
  } {
    const extraErrors: string[] = [];
    if (!ipc.fetchOk) {
      return {
        companionRunning: false,
        desktopInstalled: desktopInstalledIn,
        providerConfigured: false,
        openclawDetected: false,
        openclawConnected: false,
        extraErrors: [ipc.error || 'Could not reach Local Companion (diagnostics)'],
      };
    }
    const companionRunning = ipc.statusOk === true;
    let desktopInstalled = desktopInstalledIn;
    let providerConfigured = false;
    let mode: 'off' | 'observe' | 'on' | undefined;
    let companionBaseUrl: string | undefined;
    let modelAliases: string[] | undefined;
    if (ipc.statusOk && ipc.statusJson) {
      const j = ipc.statusJson;
      if (typeof j['desktopInstalled'] === 'boolean') {
        desktopInstalled = desktopInstalled || (j['desktopInstalled'] as boolean);
      }
      providerConfigured = j['providerConfigured'] === true;
      const m = j['mode'];
      if (m === 'off' || m === 'observe' || m === 'on') mode = m;
      if (typeof j['companionBaseUrl'] === 'string') companionBaseUrl = j['companionBaseUrl'] as string;
      if (Array.isArray(j['modelAliases'])) {
        modelAliases = (j['modelAliases'] as unknown[]).filter((x): x is string => typeof x === 'string');
      }
    } else {
      extraErrors.push(`diagnostics/status HTTP ${ipc.statusHttp}`);
    }
    let openclawDetected = false;
    let openclawConnected = false;
    if (ipc.openclawOk && ipc.openclawJson) {
      const o = ipc.openclawJson;
      openclawDetected = o.detected === true || openclawCli;
      openclawConnected = o.connected === true;
    } else {
      extraErrors.push(`diagnostics/integrations/openclaw HTTP ${ipc.openclawHttp}`);
    }
    return {
      companionRunning,
      desktopInstalled,
      providerConfigured,
      mode,
      companionBaseUrl,
      modelAliases,
      openclawDetected,
      openclawConnected,
      extraErrors,
    };
  }

  /**
   * After main process spawns the companion, HTTP may not listen for 1–3+ seconds.
   * Poll Electron's /health fetch (same as main waitForHealth) before refreshing UI.
   */
  private async waitForCompanionHealthFromMain(timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const h = await this.desktop.companionHealth();
      if (h != null) return;
      await new Promise((r) => setTimeout(r, 450));
    }
  }

  async openDownloadPage(): Promise<void> {
    await this.router.navigate(['/download']);
  }

  async navigateSignIn(): Promise<void> {
    const returnUrl = this.router.url;
    await this.router.navigate(['/login'], { queryParams: { returnUrl } });
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
