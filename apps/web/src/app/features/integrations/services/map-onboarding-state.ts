import type {
  OnboardingAction,
  OnboardingChecklistItem,
  OnboardingState,
  OnboardingStateInput,
  OnboardingStatus,
} from '../models/integration-onboarding.types';

export const ONBOARDING_COPY: Record<
  Exclude<OnboardingState, 'checking'>,
  { title: string; body: string }
> = {
  desktop_not_installed: {
    title: 'Install Spectyra Desktop',
    body: 'Install Spectyra Desktop to run optimization locally and manage your AI provider settings.',
  },
  desktop_installed_companion_not_running: {
    title: 'Open Spectyra',
    body: 'Spectyra Desktop is installed, but Local Companion is not running yet.',
  },
  not_signed_in: {
    title: 'Sign in to Spectyra',
    body: 'Sign in to start your trial and enable local optimization.',
  },
  provider_missing: {
    title: 'Add your AI provider',
    body: 'Connect Claude, OpenAI, Gemini, or another provider using your own API key.',
  },
  openclaw_not_detected: {
    title: 'Set up OpenClaw',
    body: 'We could not detect an OpenClaw connection yet. Generate or copy your local config to finish setup.',
  },
  openclaw_not_connected: {
    title: 'Connect OpenClaw to Spectyra',
    body: 'OpenClaw is installed, but it is not yet sending requests through Spectyra Local Companion.',
  },
  ready: {
    title: 'Spectyra is active',
    body: 'Your OpenClaw setup is connected and ready to optimize requests locally. Run your next task to start seeing savings.',
  },
  error: {
    title: 'Something needs attention',
    body: 'We hit a problem while checking your local setup. Review diagnostics and try again.',
  },
};

export function resolveOnboardingState(input: OnboardingStateInput): OnboardingState {
  if (input.errorMessage) return 'error';
  const desktopOk = input.isDesktopApp || input.userAcknowledgedDesktopInstall;
  if (!desktopOk) return 'desktop_not_installed';
  if (!input.companionRunning) return 'desktop_installed_companion_not_running';
  if (!input.signedIn) return 'not_signed_in';
  if (!input.providerConfigured) return 'provider_missing';
  const ocDetected = input.openclawDetectedFromRuntime || input.assumeOpenClawFromFlow;
  if (!ocDetected) return 'openclaw_not_detected';
  if (!input.openclawConnectedFromRuntime) return 'openclaw_not_connected';
  return 'ready';
}

export function actionsForState(state: OnboardingState): OnboardingAction[] {
  switch (state) {
    case 'checking':
      return [{ type: 'run_diagnostics', label: 'Refresh', primary: true }];
    case 'desktop_not_installed':
      return [
        { type: 'download_desktop', label: 'Download Spectyra Desktop', primary: true },
        { type: 'retry', label: 'I already installed it' },
      ];
    case 'desktop_installed_companion_not_running':
      return [
        { type: 'open_desktop', label: 'Open Spectyra', primary: true },
        { type: 'retry', label: 'Retry detection' },
      ];
    case 'not_signed_in':
      return [
        { type: 'sign_in', label: 'Sign in to Spectyra', primary: true },
        { type: 'open_desktop', label: 'Open desktop app' },
      ];
    case 'provider_missing':
      return [
        { type: 'configure_provider', label: 'Add your AI provider', primary: true },
        { type: 'open_desktop', label: 'Open desktop app' },
      ];
    case 'openclaw_not_detected':
      return [
        { type: 'copy_openclaw_config', label: 'Set up OpenClaw', primary: true },
        { type: 'run_diagnostics', label: 'Run diagnostics' },
      ];
    case 'openclaw_not_connected':
      return [
        { type: 'copy_openclaw_config', label: 'Copy OpenClaw config', primary: true },
        { type: 'run_diagnostics', label: 'Run diagnostics' },
      ];
    case 'ready':
      return [
        { type: 'run_test', label: 'Run test request', primary: true },
        { type: 'copy_openclaw_config', label: 'Copy config' },
      ];
    case 'error':
      return [
        { type: 'retry', label: 'Try again', primary: true },
        { type: 'run_diagnostics', label: 'Run diagnostics' },
      ];
    default:
      return [{ type: 'retry', label: 'Retry', primary: true }];
  }
}

const CHECKLIST_DEF: Array<{
  id: OnboardingChecklistItem['id'];
  label: string;
  ok: (st: OnboardingStatus) => boolean;
  failedState: OnboardingState;
}> = [
  { id: 'desktop', label: 'Spectyra Desktop installed', ok: (s) => s.desktopInstalled, failedState: 'desktop_not_installed' },
  {
    id: 'companion',
    label: 'Local Companion running',
    ok: (s) => s.companionRunning,
    failedState: 'desktop_installed_companion_not_running',
  },
  { id: 'signed_in', label: 'Signed in', ok: (s) => s.signedIn, failedState: 'not_signed_in' },
  {
    id: 'provider',
    label: 'AI provider connected',
    ok: (s) => s.providerConfigured,
    failedState: 'provider_missing',
  },
  {
    id: 'oc_detect',
    label: 'OpenClaw detected',
    ok: (s) => s.openclawDetected,
    failedState: 'openclaw_not_detected',
  },
  {
    id: 'oc_conn',
    label: 'OpenClaw connected to Spectyra',
    ok: (s) => s.openclawConnected,
    failedState: 'openclaw_not_connected',
  },
];

export function buildChecklistItems(st: OnboardingStatus): OnboardingChecklistItem[] {
  if (st.state === 'checking') {
    return CHECKLIST_DEF.map((d) => ({ id: d.id, label: d.label, status: 'pending' as const }));
  }
  return CHECKLIST_DEF.map((d) => {
    if (d.ok(st)) return { id: d.id, label: d.label, status: 'success' as const };
    if (st.state === d.failedState) return { id: d.id, label: d.label, status: 'failure' as const };
    return { id: d.id, label: d.label, status: 'pending' as const };
  });
}

export function buildOnboardingStatus(
  state: OnboardingState,
  partial: Omit<OnboardingStatus, 'state' | 'actions' | 'message'>,
  message?: string,
): OnboardingStatus {
  return {
    state,
    ...partial,
    message,
    actions: actionsForState(state),
  };
}
