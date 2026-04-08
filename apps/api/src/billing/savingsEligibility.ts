/**
 * Whether Spectyra should treat usage as Observe-only (projected / non-accruing savings)
 * vs full paid/trial savings.
 */

import type { Org } from "@spectyra/shared";
import { hasActiveAccess, type HasActiveAccessOpts } from "../services/storage/orgsRepo.js";

export function isSavingsObserveOnly(
  org: Org | null | undefined,
  opts?: HasActiveAccessOpts,
): boolean {
  if (!org) return true;
  if (org.observe_only_override === true) return true;
  if (org.observe_only_override === false) return false;
  return !hasActiveAccess(org, opts);
}
