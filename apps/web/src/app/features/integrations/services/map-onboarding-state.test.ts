/**
 * State machine tests — run: pnpm exec tsx src/app/features/integrations/services/map-onboarding-state.test.ts
 */
import assert from 'node:assert';
import { resolveOnboardingState } from './map-onboarding-state';
import type { OnboardingStateInput } from '../models/integration-onboarding.types';

function base(over: Partial<OnboardingStateInput>): OnboardingStateInput {
  return {
    isDesktopApp: false,
    userAcknowledgedDesktopInstall: false,
    assumeOpenClawFromFlow: false,
    companionRunning: true,
    signedIn: true,
    providerConfigured: true,
    openclawDetectedFromRuntime: true,
    openclawConnectedFromRuntime: true,
    ...over,
  };
}

function run() {
  assert.equal(resolveOnboardingState(base({ isDesktopApp: false, userAcknowledgedDesktopInstall: false })), 'desktop_not_installed');
  assert.equal(resolveOnboardingState(base({ isDesktopApp: true, companionRunning: false })), 'desktop_installed_companion_not_running');
  assert.equal(resolveOnboardingState(base({ isDesktopApp: true, signedIn: false })), 'not_signed_in');
  assert.equal(resolveOnboardingState(base({ isDesktopApp: true, providerConfigured: false })), 'provider_missing');
  assert.equal(
    resolveOnboardingState(base({ isDesktopApp: true, openclawDetectedFromRuntime: false, assumeOpenClawFromFlow: false })),
    'openclaw_not_detected',
  );
  assert.equal(
    resolveOnboardingState(
      base({ isDesktopApp: true, openclawDetectedFromRuntime: true, openclawConnectedFromRuntime: false }),
    ),
    'openclaw_not_connected',
  );
  assert.equal(resolveOnboardingState(base({ isDesktopApp: true })), 'ready');
  assert.equal(
    resolveOnboardingState(
      base({ isDesktopApp: true, assumeOpenClawFromFlow: true, openclawDetectedFromRuntime: false, openclawConnectedFromRuntime: false }),
    ),
    'openclaw_not_connected',
  );
  console.log('map-onboarding-state tests OK');
}

run();
