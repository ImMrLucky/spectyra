export type OnboardingState =
  | 'checking'
  | 'desktop_not_installed'
  | 'desktop_installed_companion_not_running'
  | 'not_signed_in'
  | 'provider_missing'
  | 'openclaw_not_detected'
  | 'openclaw_not_connected'
  | 'ready'
  | 'error';

export type OnboardingActionType =
  | 'download_desktop'
  | 'open_desktop'
  | 'sign_in'
  | 'configure_provider'
  | 'copy_openclaw_config'
  | 'run_diagnostics'
  | 'retry'
  | 'run_test';

export interface OnboardingAction {
  type: OnboardingActionType;
  label: string;
  primary?: boolean;
}

export interface OnboardingStatus {
  state: OnboardingState;
  desktopInstalled: boolean;
  companionRunning: boolean;
  signedIn: boolean;
  providerConfigured: boolean;
  openclawDetected: boolean;
  openclawConnected: boolean;
  mode?: 'off' | 'on';
  companionBaseUrl?: string;
  modelAliases?: string[];
  message?: string;
  actions: OnboardingAction[];
}

export interface OnboardingChecklistItem {
  id: string;
  label: string;
  status: 'success' | 'pending' | 'failure';
}

export interface IntegrationDiagnostics {
  desktopInstalled: boolean;
  companionRunning: boolean;
  signedIn: boolean;
  providerConfigured: boolean;
  integrationDetected: boolean;
  integrationConnected: boolean;
  mode?: 'off' | 'on';
  companionBaseUrl?: string;
  modelAliases?: string[];
  errors?: string[];
}

/** Inputs for pure state resolution (testable). */
export interface OnboardingStateInput {
  isDesktopApp: boolean;
  /** User clicked "I already installed" (web) or similar. */
  userAcknowledgedDesktopInstall: boolean;
  /** Query hint e.g. from ClawHub / skill flow — treat OpenClaw as present. */
  assumeOpenClawFromFlow: boolean;
  companionRunning: boolean;
  signedIn: boolean;
  providerConfigured: boolean;
  openclawDetectedFromRuntime: boolean;
  openclawConnectedFromRuntime: boolean;
  errorMessage?: string;
}
