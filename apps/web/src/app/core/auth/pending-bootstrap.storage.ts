/**
 * When sign-up requires email confirmation, Supabase returns no session — we cannot call
 * POST /auth/bootstrap yet. The org name the user entered is stored here until first login.
 */
const KEY = 'spectyra_pending_bootstrap';

export type PendingBootstrap = { orgName: string; projectName?: string };

export function savePendingBootstrap(p: PendingBootstrap): void {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        orgName: p.orgName.trim(),
        projectName: p.projectName?.trim() || '',
      }),
    );
  } catch {
    /* private mode / quota */
  }
}

export function readPendingBootstrap(): PendingBootstrap | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { orgName?: string; projectName?: string };
    if (!o?.orgName || typeof o.orgName !== 'string' || !o.orgName.trim()) return null;
    return {
      orgName: o.orgName.trim(),
      projectName: o.projectName?.trim() || undefined,
    };
  } catch {
    return null;
  }
}

export function clearPendingBootstrap(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
