import type { ProviderKeySetResult } from '../../../spectyra-window';

/** User-facing copy only — no ports, paths, or process names unless expanded. */
export const DESKTOP_SETUP = {
  providerSaveWorking: 'Saving your key…',
  providerSaveSuccess: 'Your key is saved. Spectyra is ready to use.',
  providerSaveRetry:
    'Still connecting. Wait a few seconds and tap Try again. If this keeps happening, fully quit Spectyra (Cmd+Q or File → Quit) and open it again.',
  providerSaveFailed: 'We could not save your key. Check your connection, then tap Try again.',
  technicalDetailsLabel: 'Technical details (for support)',
} as const;

/**
 * Maps main-process provider-key outcomes to a single calm message.
 * Raw `hint` / `error` are for support or an optional details disclosure only.
 */
export function friendlyProviderKeyUserMessage(result: ProviderKeySetResult): {
  success: boolean;
  /** Shown to the user (null when success). */
  message: string | null;
  /** Optional: show under “Technical details”. */
  technical?: string;
} {
  if (result.ok && result.providerReady) {
    return { success: true, message: null };
  }
  if (!result.ok) {
    return {
      success: false,
      message: DESKTOP_SETUP.providerSaveFailed,
      technical: result.error,
    };
  }
  return {
    success: false,
    message: DESKTOP_SETUP.providerSaveRetry,
    technical: result.hint,
  };
}
