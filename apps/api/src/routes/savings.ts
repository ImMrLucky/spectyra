import { Router } from "express";
import {
  getSavingsSummary,
  getSavingsTimeseries,
  getSavingsByLevel,
  getSavingsByPath,
  getLevelUsageTimeseries,
  type SavingsFilters,
} from "../services/storage/savingsRepo.js";
import { redactSavingsData } from "../middleware/redact.js";
import { getDb } from "../services/storage/db.js";

function buildWhereClause(filters: SavingsFilters, tablePrefix: string = "l"): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  const prefix = tablePrefix;
  
  if (filters.from) {
    conditions.push(`${prefix}.created_at >= ?`);
    params.push(filters.from);
  }
  
  if (filters.to) {
    conditions.push(`${prefix}.created_at <= ?`);
    params.push(filters.to + " 23:59:59");
  }
  
  if (filters.provider) {
    conditions.push(`${prefix}.provider = ?`);
    params.push(filters.provider);
  }
  
  if (filters.model) {
    conditions.push(`${prefix}.model = ?`);
    params.push(filters.model);
  }
  
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { sql: where, params };
}

export const savingsRouter = Router();

savingsRouter.get("/summary", (req, res) => {
  try {
    const filters: SavingsFilters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      path: req.query.path as "talk" | "code" | "both" | undefined,
      provider: req.query.provider as string | undefined,
      model: req.query.model as string | undefined,
    };
    
    const summary = getSavingsSummary(filters);
    res.json(redactSavingsData(summary));
  } catch (error: any) {
    console.error("Savings summary error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

savingsRouter.get("/timeseries", (req, res) => {
  try {
    const filters: SavingsFilters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      path: req.query.path as "talk" | "code" | "both" | undefined,
      provider: req.query.provider as string | undefined,
      model: req.query.model as string | undefined,
    };
    
    const bucket = (req.query.bucket as "day" | "week") || "day";
    const timeseries = getSavingsTimeseries(filters, bucket);
    res.json(timeseries.map(redactSavingsData));
  } catch (error: any) {
    console.error("Savings timeseries error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

savingsRouter.get("/by-level", (req, res) => {
  try {
    const filters: SavingsFilters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      path: req.query.path as "talk" | "code" | "both" | undefined,
      provider: req.query.provider as string | undefined,
      model: req.query.model as string | undefined,
    };
    
    const breakdown = getSavingsByLevel(filters);
    res.json(breakdown.map(redactSavingsData));
  } catch (error: any) {
    console.error("Savings by-level error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

savingsRouter.get("/by-path", (req, res) => {
  try {
    const filters: SavingsFilters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      path: req.query.path as "talk" | "code" | "both" | undefined,
      provider: req.query.provider as string | undefined,
      model: req.query.model as string | undefined,
    };
    
    const breakdown = getSavingsByPath(filters);
    res.json(breakdown);
  } catch (error: any) {
    console.error("Savings by-path error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

savingsRouter.get("/level-usage-timeseries", (req, res) => {
  try {
    const filters: SavingsFilters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      path: req.query.path as "talk" | "code" | "both" | undefined,
      provider: req.query.provider as string | undefined,
      model: req.query.model as string | undefined,
    };
    
    const bucket = (req.query.bucket as "day" | "week") || "day";
    const timeseries = getLevelUsageTimeseries(filters, bucket);
    res.json(timeseries.map(redactSavingsData));
  } catch (error: any) {
    console.error("Level usage timeseries error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

savingsRouter.get("/export", (req, res) => {
  try {
    const type = (req.query.type as "verified" | "all") || "verified";
    const format = (req.query.format as "csv" | "json") || "csv";
    
    const filters: SavingsFilters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      path: req.query.path as "talk" | "code" | "both" | undefined,
      provider: req.query.provider as string | undefined,
      model: req.query.model as string | undefined,
    };
    
    const { sql: whereClause, params } = buildWhereClause(filters, "l");
    let ledgerWhere = whereClause;
    if (filters.path && filters.path !== "both") {
      ledgerWhere = ledgerWhere 
        ? `${ledgerWhere} AND l.path = ?`
        : `WHERE l.path = ?`;
      if (!ledgerWhere.includes("WHERE")) {
        params.push(filters.path);
      }
    }
    
    if (type === "verified") {
      ledgerWhere = ledgerWhere 
        ? `${ledgerWhere} AND l.savings_type IN ('verified', 'shadow_verified')`
        : `WHERE l.savings_type IN ('verified', 'shadow_verified')`;
    }
    
    const db = getDb();
    const rows = db.prepare(`
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
    `).all(...(ledgerWhere ? params : [])) as any[];
    
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
    console.error("Export error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

function buildWhereClause(filters: SavingsFilters, tablePrefix: string = "l"): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  const prefix = tablePrefix;
  
  if (filters.from) {
    conditions.push(`${prefix}.created_at >= ?`);
    params.push(filters.from);
  }
  
  if (filters.to) {
    conditions.push(`${prefix}.created_at <= ?`);
    params.push(filters.to + " 23:59:59");
  }
  
  if (filters.provider) {
    conditions.push(`${prefix}.provider = ?`);
    params.push(filters.provider);
  }
  
  if (filters.model) {
    conditions.push(`${prefix}.model = ?`);
    params.push(filters.model);
  }
  
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { sql: where, params };
}
