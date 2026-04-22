import type { Response } from "express";
import {
  type AuthenticatedRequest,
  resolvePlatformOwnerAccess,
} from "../middleware/auth.js";
import { safeLog } from "../utils/redaction.js";

/**
 * Shared body for GET /v1/auth/is-platform-owner and GET /v1/account/is-platform-owner.
 * Use after `requireUserSession` in index.ts.
 */
export async function isPlatformOwnerGet(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const access = await resolvePlatformOwnerAccess(req);
    res.json({ is_platform_owner: access.kind === "allow" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    safeLog("error", "is-platform-owner error", { error: msg });
    res.status(500).json({ error: "Internal server error" });
  }
}
