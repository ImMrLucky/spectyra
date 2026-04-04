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
    title: 'Use Spectyra on your computer',
    body: 'Download the Spectyra Desktop app. Everything runs locally—your keys stay on your machine.',
  },
  desktop_installed_companion_not_running: {
    title: 'Starting Spectyra',
    body: 'Give it a moment, then tap Refresh. If nothing changes, quit the app completely and open it again.',
  },
  not_signed_in: {
    title: 'Optional: create an account',
    body: 'You can use OpenClaw and save keys without signing in. An account adds cloud sync and the web dashboard when you want it.',
  },
  provider_missing: {
    title: 'Add your AI key',
    body: 'Paste the API key from OpenAI, Anthropic, or Groq below. It is stored only on this computer.',
  },
  openclaw_not_detected: {
    title: 'Install or open OpenClaw',
    body: 'When you are ready, use the copy button to add Spectyra to OpenClaw, or run the installer from the setup page.',
  },
  openclaw_not_connected: {
    title: 'Point OpenClaw at Spectyra',
    body: 'Copy the small settings block we give you into OpenClaw once. After that, traffic runs through Spectyra automatically.',
  },
  ready: {
    title: 'You are set',
    body: 'Open Live to watch activity and savings. You can change modes anytime in Settings.',
  },
  error: {
    title: 'Could not check status',
    body: 'Tap Refresh or open Settings. If it keeps happening, quit Spectyra and reopen it.',
  },
};

export function resolveOnboardingState(input: OnboardingStateInput): OnboardingState {
  if (input.errorMessage) return 'error';
  const desktopOk = input.isDesktopApp || input.userAcknowledgedDesktopInstall;
  if (!desktopOk) return 'desktop_not_installed';
  if (!input.companionRunning) return 'desktop_installed_companion_not_running';
  /**
   * Desktop: provider key before account — local-first; avoids blocking paste-key on sign-in.
   * Web: account first (org / dashboard), then provider.
   */
  if (input.isDesktopApp) {
    if (!input.providerConfigured) return 'provider_missing';
    if (!input.signedIn) return 'not_signed_in';
  } else {
    if (!input.signedIn) return 'not_signed_in';
    if (!input.providerConfigured) return 'provider_missing';
  }
  const ocDetected = input.openclawDetectedFromRuntime || input.assumeOpenClawFromFlow;
  if (!ocDetected) return 'openclaw_not_detected';
  if (!input.openclawConnectedFromRuntime) return 'openclaw_not_connected';
  return 'ready';
}

export function actionsForState(
  state: OnboardingState,
  opts?: { isDesktop?: boolean },
): OnboardingAction[] {
  const isDesktop = opts?.isDesktop === true;
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
        {
          type: 'open_desktop',
          label: isDesktop ? 'Start Local Companion' : 'Open Spectyra',
          primary: true,
        },
        { type: 'retry', label: 'Retry detection' },
      ];
    case 'not_signed_in':
      return [
        { type: 'sign_in', label: isDesktop ? 'Sign in (optional)' : 'Sign in', primary: true },
        ...(isDesktop ? [] : [{ type: 'open_desktop' as const, label: 'Open desktop app' }]),
      ];
    case 'provider_missing':
      return [
        { type: 'configure_provider', label: isDesktop ? 'Add API key' : 'Add your AI provider', primary: true },
        ...(isDesktop ? [] : [{ type: 'open_desktop' as const, label: 'Open desktop app' }]),
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
        { type: 'retry', label: 'Refresh', primary: true },
        { type: 'run_diagnostics', label: 'Connection check' },
      ];
    default:
      return [{ type: 'retry', label: 'Retry', primary: true }];
  }
}

const CHECKLIST_COMMON_TAIL: Array<{
  id: OnboardingChecklistItem['id'];
  label: string;
  ok: (st: OnboardingStatus) => boolean;
  failedState: OnboardingState;
}> = [
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

const CHECKLIST_DESKTOP_ORDER: Array<{
  id: OnboardingChecklistItem['id'];
  label: string;
  ok: (st: OnboardingStatus) => boolean;
  failedState: OnboardingState;
}> = [
  { id: 'desktop', label: 'Spectyra Desktop installed', ok: (s) => s.desktopInstalled, failedState: 'desktop_not_installed' },
  {
    id: 'companion',
    label: 'Spectyra engine running',
    ok: (s) => s.companionRunning,
    failedState: 'desktop_installed_companion_not_running',
  },
  {
    id: 'provider',
    label: 'AI key added',
    ok: (s) => s.providerConfigured,
    failedState: 'provider_missing',
  },
  { id: 'signed_in', label: 'Account (optional)', ok: (s) => s.signedIn, failedState: 'not_signed_in' },
  ...CHECKLIST_COMMON_TAIL,
];

const CHECKLIST_WEB_ORDER: Array<{
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
  { id: 'signed_in', label: 'Signed in to Spectyra', ok: (s) => s.signedIn, failedState: 'not_signed_in' },
  {
    id: 'provider',
    label: 'AI provider connected',
    ok: (s) => s.providerConfigured,
    failedState: 'provider_missing',
  },
  ...CHECKLIST_COMMON_TAIL,
];

export function buildChecklistItems(st: OnboardingStatus, opts?: { isDesktop?: boolean }): OnboardingChecklistItem[] {
  const CHECKLIST_DEF = opts?.isDesktop ? CHECKLIST_DESKTOP_ORDER : CHECKLIST_WEB_ORDER;
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
  actionOpts?: { isDesktop?: boolean },
): OnboardingStatus {
  return {
    state,
    ...partial,
    message,
    actions: actionsForState(state, actionOpts),
  };
}
