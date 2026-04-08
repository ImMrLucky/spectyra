/**
 * Platform superuser console — manage platform_roles and org exempt flags.
 * Only emails with role `superuser` in platform_roles may call these routes.
 */

import { Router } from "express";
import {
  requireUserSession,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import {
  listPlatformRoles,
  upsertPlatformRole,
  deletePlatformRole,
  countSuperusers,
  type PlatformRoleName,
} from "../services/storage/platformRolesRepo.js";
import { setOrgPlatformExempt, setOrgObserveOnlyOverride } from "../services/storage/orgsRepo.js";
import { safeLog } from "../utils/redaction.js";

export const superuserRouter = Router();

function requireSuperuser(
  req: AuthenticatedRequest,
  res: import("express").Response,
  next: import("express").NextFunction,
): void {
  if (req.auth?.platformRole !== "superuser") {
    res.status(403).json({ error: "Superuser only" });
    return;
  }
  next();
}

superuserRouter.get("/me", requireUserSession, (req: AuthenticatedRequest, res) => {
  res.json({
    email: req.auth?.email ?? null,
    platform_role: req.auth?.platformRole ?? null,
    is_superuser: req.auth?.platformRole === "superuser",
  });
});

superuserRouter.get(
  "/platform-users",
  requireUserSession,
  requireSuperuser,
  async (_req, res) => {
    try {
      const users = await listPlatformRoles();
      res.json({ users });
    } catch (e: any) {
      safeLog("error", "superuser list platform users", { error: e.message });
      res.status(500).json({ error: e.message || "Internal error" });
    }
  },
);

superuserRouter.post(
  "/platform-users",
  requireUserSession,
  requireSuperuser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body as { email?: string; role?: PlatformRoleName };
      const email = body.email?.trim();
      const role = body.role;
      if (!email || !role) {
        res.status(400).json({ error: "email and role required" });
        return;
      }
      if (!["superuser", "admin", "exempt"].includes(role)) {
        res.status(400).json({ error: "invalid role" });
        return;
      }
      const actor = req.auth?.email?.trim();
      if (!actor) {
        res.status(400).json({ error: "missing actor email" });
        return;
      }
      const row = await upsertPlatformRole(email, role, actor);
      res.json({ user: row });
    } catch (e: any) {
      safeLog("error", "superuser upsert platform user", { error: e.message });
      res.status(500).json({ error: e.message || "Internal error" });
    }
  },
);

superuserRouter.delete(
  "/platform-users/:email",
  requireUserSession,
  requireSuperuser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const target = decodeURIComponent(req.params.email || "").trim().toLowerCase();
      if (!target) {
        res.status(400).json({ error: "email required" });
        return;
      }
      const rows = await listPlatformRoles();
      const targetRow = rows.find((r) => r.email.toLowerCase() === target);
      if (targetRow?.role === "superuser" && (await countSuperusers()) <= 1) {
        res.status(400).json({ error: "Cannot remove the last superuser" });
        return;
      }
      const ok = await deletePlatformRole(target);
      res.json({ deleted: ok });
    } catch (e: any) {
      safeLog("error", "superuser delete platform user", { error: e.message });
      res.status(500).json({ error: e.message || "Internal error" });
    }
  },
);

superuserRouter.patch(
  "/orgs/:orgId/savings-observe-mode",
  requireUserSession,
  requireSuperuser,
  async (req, res) => {
    try {
      const orgId = req.params.orgId;
      const mode = (req.body as { mode?: string })?.mode;
      let override: boolean | null = null;
      if (mode === "auto" || mode === undefined) override = null;
      else if (mode === "force_observe") override = true;
      else if (mode === "force_full") override = false;
      else {
        res.status(400).json({ error: "mode must be auto | force_observe | force_full" });
        return;
      }
      const org = await setOrgObserveOnlyOverride(orgId, override);
      res.json({ org });
    } catch (e: any) {
      if (e.message?.includes("not found")) {
        res.status(404).json({ error: e.message });
        return;
      }
      safeLog("error", "superuser savings observe mode", { error: e.message });
      res.status(500).json({ error: e.message || "Internal error" });
    }
  },
);

superuserRouter.patch(
  "/orgs/:orgId/platform-exempt",
  requireUserSession,
  requireSuperuser,
  async (req, res) => {
    try {
      const orgId = req.params.orgId;
      const exempt = !!(req.body as { exempt?: boolean })?.exempt;
      const org = await setOrgPlatformExempt(orgId, exempt);
      res.json({ org });
    } catch (e: any) {
      if (e.message?.includes("not found")) {
        res.status(404).json({ error: e.message });
        return;
      }
      safeLog("error", "superuser org exempt", { error: e.message });
      res.status(500).json({ error: e.message || "Internal error" });
    }
  },
);
