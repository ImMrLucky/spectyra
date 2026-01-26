import { Router } from "express";
import { requireUserSession, requireSpectyraApiKey, optionalProviderKey, type AuthenticatedRequest } from "../middleware/auth.js";
import {
  getSavingsSummary,
  getSavingsTimeseries,
  getSavingsByLevel,
  getSavingsByPath,
  getLevelUsageTimeseries,
  type SavingsFilters,
} from "../services/storage/savingsRepo.js";
import { redactSavingsData } from "../middleware/redact.js";
import { query, queryOne } from "../services/storage/db.js";
import { safeLog } from "../utils/redaction.js";

function buildWhereClause(filters: SavingsFilters, tablePrefix: string = "l"): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;
  const prefix = tablePrefix;
  
  if (filters.from) {
    conditions.push(`${prefix}.created_at >= $${paramIndex++}`);
    params.push(filters.from);
  }
  
  if (filters.to) {
    conditions.push(`${prefix}.created_at <= $${paramIndex++}`);
    params.push(filters.to + " 23:59:59");
  }
  
  if (filters.provider) {
    conditions.push(`${prefix}.provider = $${paramIndex++}`);
    params.push(filters.provider);
  }
  
  if (filters.model) {
    conditions.push(`${prefix}.model = $${paramIndex++}`);
    params.push(filters.model);
  }
  
  if (filters.orgId) {
    conditions.push(`${prefix}.org_id = $${paramIndex++}`);
    params.push(filters.orgId);
  }
  
  if (filters.projectId !== undefined && filters.projectId !== null) {
    conditions.push(`${prefix}.project_id = $${paramIndex++}`);
    params.push(filters.projectId);
  } else if (filters.projectId === null && filters.orgId) {
    conditions.push(`${prefix}.project_id IS NULL`);
  }
  
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { sql: where, params };
}

export const savingsRouter = Router();

// Apply authentication middleware (Supabase JWT for dashboard)
savingsRouter.use(requireUserSession);

savingsRouter.get("/summary", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get user's org
    const membership = await queryOne<{ org_id: string }>(`
      SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
    `, [req.auth.userId]);

    if (!membership) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const filters: SavingsFilters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      path: req.query.path as "talk" | "code" | "both" | undefined,
      provider: req.query.provider as string | undefined,
      model: req.query.model as string | undefined,
      orgId: membership.org_id,
      projectId: req.query.project_id as string | undefined || null,
    };
    
    const summary = await getSavingsSummary(filters);
    res.json(redactSavingsData(summary));
  } catch (error: any) {
    safeLog("error", "Savings summary error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

savingsRouter.get("/timeseries", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const membership = await queryOne<{ org_id: string }>(`
      SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
    `, [req.auth.userId]);

    if (!membership) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const filters: SavingsFilters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      path: req.query.path as "talk" | "code" | "both" | undefined,
      provider: req.query.provider as string | undefined,
      model: req.query.model as string | undefined,
      orgId: membership.org_id,
      projectId: req.query.project_id as string | undefined || null,
    };
    
    const bucket = (req.query.bucket as "day" | "week") || "day";
    const timeseries = await getSavingsTimeseries(filters, bucket);
    res.json(timeseries.map(redactSavingsData));
  } catch (error: any) {
    safeLog("error", "Savings timeseries error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

savingsRouter.get("/by-level", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const membership = await queryOne<{ org_id: string }>(`
      SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
    `, [req.auth.userId]);

    if (!membership) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const filters: SavingsFilters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      path: req.query.path as "talk" | "code" | "both" | undefined,
      provider: req.query.provider as string | undefined,
      model: req.query.model as string | undefined,
      orgId: membership.org_id,
      projectId: req.query.project_id as string | undefined || null,
    };
    
    const breakdown = await getSavingsByLevel(filters);
    res.json(breakdown.map(redactSavingsData));
  } catch (error: any) {
    safeLog("error", "Savings by-level error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

savingsRouter.get("/by-path", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const membership = await queryOne<{ org_id: string }>(`
      SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
    `, [req.auth.userId]);

    if (!membership) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const filters: SavingsFilters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      path: req.query.path as "talk" | "code" | "both" | undefined,
      provider: req.query.provider as string | undefined,
      model: req.query.model as string | undefined,
      orgId: membership.org_id,
      projectId: req.query.project_id as string | undefined || null,
    };
    
    const breakdown = await getSavingsByPath(filters);
    res.json(breakdown);
  } catch (error: any) {
    safeLog("error", "Savings by-path error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

savingsRouter.get("/level-usage-timeseries", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const membership = await queryOne<{ org_id: string }>(`
      SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
    `, [req.auth.userId]);

    if (!membership) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const filters: SavingsFilters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      path: req.query.path as "talk" | "code" | "both" | undefined,
      provider: req.query.provider as string | undefined,
      model: req.query.model as string | undefined,
      orgId: membership.org_id,
      projectId: req.query.project_id as string | undefined || null,
    };
    
    const bucket = (req.query.bucket as "day" | "week") || "day";
    const timeseries = await getLevelUsageTimeseries(filters, bucket);
    res.json(timeseries.map(redactSavingsData));
  } catch (error: any) {
    safeLog("error", "Level usage timeseries error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

savingsRouter.get("/export", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const membership = await queryOne<{ org_id: string }>(`
      SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
    `, [req.auth.userId]);

    if (!membership) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const type = (req.query.type as "verified" | "all") || "verified";
    const format = (req.query.format as "csv" | "json") || "csv";
    
    const filters: SavingsFilters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      path: req.query.path as "talk" | "code" | "both" | undefined,
      provider: req.query.provider as string | undefined,
      model: req.query.model as string | undefined,
      orgId: membership.org_id,
      projectId: req.query.project_id as string | undefined || null,
    };
    
    const { sql: whereClause, params } = buildWhereClause(filters, "l");
    let ledgerWhere = whereClause;
    let paramIndex = params.length + 1;
    
    if (filters.path && filters.path !== "both") {
      ledgerWhere = ledgerWhere 
        ? `${ledgerWhere} AND l.path = $${paramIndex++}`
        : `WHERE l.path = $${paramIndex++}`;
      params.push(filters.path);
    }
    
    if (type === "verified") {
      ledgerWhere = ledgerWhere 
        ? `${ledgerWhere} AND l.savings_type IN ('verified', 'shadow_verified')`
        : `WHERE l.savings_type IN ('verified', 'shadow_verified')`;
    }
    
    const result = await query<any>(`
      SELECT 
        created_at,
        savings_type,
        path,
        provider,
        model,
        optimization_level,
        baseline_tokens,
        optimized_tokens,
        tokens_saved,
        pct_saved,
        baseline_cost_usd,
        optimized_cost_usd,
        cost_saved_usd,
        confidence
      FROM savings_ledger l
      ${ledgerWhere || ""}
      ORDER BY created_at DESC
    `, params);
    
    const rows = result.rows;
    
    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="savings-export-${Date.now()}.json"`);
      res.json(rows);
    } else {
      // CSV
      const headers = [
        "created_at", "savings_type", "path", "provider", "model", "optimization_level",
        "baseline_tokens", "optimized_tokens", "tokens_saved", "pct_saved",
        "baseline_cost_usd", "optimized_cost_usd", "cost_saved_usd", "confidence"
      ];
      
      const csvRows = [
        headers.join(","),
        ...rows.map(row => 
          headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return "";
            if (typeof val === "string" && val.includes(",")) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          }).join(",")
        ),
      ];
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="savings-export-${Date.now()}.csv"`);
      res.send(csvRows.join("\n"));
    }
  } catch (error: any) {
    safeLog("error", "Export error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
