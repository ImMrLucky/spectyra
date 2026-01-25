import { getDb } from "./db.js";

export interface SavingsSummary {
  range: { from: string; to: string };
  verified: {
    replays: number;
    tokens_saved: number;
    cost_saved_usd: number;
    pct_saved: number;
  };
  estimated: {
    rows: number;
    tokens_saved: number;
    cost_saved_usd: number;
    pct_saved: number;
    avg_confidence_band: "high" | "medium" | "low";
  };
  combined: {
    tokens_saved: number;
    cost_saved_usd: number;
    pct_saved: number;
  };
}

export interface TimeseriesPoint {
  date: string;
  verified: {
    tokens_saved: number;
    cost_saved_usd: number;
    replays: number;
  };
  estimated: {
    tokens_saved: number;
    cost_saved_usd: number;
    rows: number;
    avg_confidence_band: "high" | "medium" | "low";
  };
  combined: {
    tokens_saved: number;
    cost_saved_usd: number;
  };
}

export interface LevelBreakdown {
  level: number;
  verified: {
    tokens_saved: number;
    cost_saved_usd: number;
    replays: number;
    pct_saved: number;
  };
  estimated: {
    tokens_saved: number;
    cost_saved_usd: number;
    rows: number;
    pct_saved: number;
    avg_confidence_band: "high" | "medium" | "low";
  };
  combined: {
    tokens_saved: number;
    cost_saved_usd: number;
    pct_saved: number;
  };
}

export interface PathBreakdown {
  path: "talk" | "code";
  replays: number;
  tokens_saved: number;
  pct_saved: number;
  cost_saved_usd: number;
}

export interface SavingsFilters {
  from?: string;
  to?: string;
  path?: "talk" | "code" | "both";
  provider?: string;
  model?: string;
}

function buildWhereClause(filters: SavingsFilters, tablePrefix: string = "p"): { sql: string; params: any[] } {
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
  
  if (filters.path && filters.path !== "both") {
    conditions.push(`${prefix}.path = ?`);
    params.push(filters.path);
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

export function getSavingsSummary(filters: SavingsFilters): SavingsSummary {
  const db = getDb();
  const { sql: whereClause, params } = buildWhereClause(filters, "l");
  
  // Build path filter for ledger
  let ledgerWhere = whereClause;
  if (filters.path && filters.path !== "both") {
    ledgerWhere = ledgerWhere 
      ? `${ledgerWhere} AND l.path = ?`
      : `WHERE l.path = ?`;
    if (!ledgerWhere.includes("WHERE")) {
      params.push(filters.path);
    }
  }
  
  // Get date range from ledger
  const dateRange = db.prepare(`
    SELECT 
      MIN(created_at) as from_date,
      MAX(created_at) as to_date
    FROM savings_ledger l
    ${ledgerWhere || ""}
  `).get(...(ledgerWhere ? params : [])) as { from_date: string | null; to_date: string | null };
  
  // Count replays (verified only)
  const replayCount = db.prepare(`
    SELECT COUNT(DISTINCT replay_id) as count
    FROM savings_ledger l
    WHERE l.savings_type IN ('verified', 'shadow_verified')
    ${ledgerWhere || ""}
  `).get(...(ledgerWhere ? params : [])) as { count: number };
  
  // Aggregate verified savings
  const verified = db.prepare(`
    SELECT 
      SUM(baseline_tokens) as baseline_tokens,
      SUM(tokens_saved) as tokens_saved,
      SUM(cost_saved_usd) as cost_saved
    FROM savings_ledger l
    WHERE l.savings_type IN ('verified', 'shadow_verified')
    ${ledgerWhere || ""}
  `).get(...(ledgerWhere ? params : [])) as any;
  
  // Aggregate estimated savings
  const estimated = db.prepare(`
    SELECT 
      COUNT(*) as rows,
      SUM(baseline_tokens) as baseline_tokens,
      SUM(tokens_saved) as tokens_saved,
      SUM(cost_saved_usd) as cost_saved,
      AVG(confidence) as avg_confidence
    FROM savings_ledger l
    WHERE l.savings_type = 'estimated'
    ${ledgerWhere || ""}
  `).get(...(ledgerWhere ? params : [])) as any;
  
  const vSaved = verified.tokens_saved || 0;
  const vBaseTokens = verified.baseline_tokens || 0;
  const vPctSaved = vBaseTokens > 0 ? (vSaved / vBaseTokens) * 100 : 0;
  const vCostSaved = verified.cost_saved || 0;
  
  const eSaved = estimated.tokens_saved || 0;
  const eBaseTokens = estimated.baseline_tokens || 0;
  const ePctSaved = eBaseTokens > 0 ? (eSaved / eBaseTokens) * 100 : 0;
  const eCostSaved = estimated.cost_saved || 0;
  const eAvgConf = estimated.avg_confidence || 0;
  const eConfBand = eAvgConf >= 0.85 ? "high" : eAvgConf >= 0.70 ? "medium" : "low";
  
  const combinedSaved = vSaved + eSaved;
  const combinedBaseTokens = vBaseTokens + eBaseTokens;
  const combinedPctSaved = combinedBaseTokens > 0 ? (combinedSaved / combinedBaseTokens) * 100 : 0;
  const combinedCostSaved = vCostSaved + eCostSaved;
  
  const today = new Date().toISOString().split('T')[0];
  
  return {
    range: {
      from: dateRange.from_date || today,
      to: dateRange.to_date || today,
    },
    verified: {
      replays: replayCount.count || 0,
      tokens_saved: vSaved,
      cost_saved_usd: vCostSaved,
      pct_saved: vPctSaved,
    },
    estimated: {
      rows: estimated.rows || 0,
      tokens_saved: eSaved,
      cost_saved_usd: eCostSaved,
      pct_saved: ePctSaved,
      avg_confidence_band: eConfBand,
    },
    combined: {
      tokens_saved: combinedSaved,
      cost_saved_usd: combinedCostSaved,
      pct_saved: combinedPctSaved,
    },
  };
}

export function getSavingsTimeseries(filters: SavingsFilters, bucket: "day" | "week" = "day"): TimeseriesPoint[] {
  const db = getDb();
  
  // Build parameters
  const params: any[] = [];
  const conditions: string[] = [];
  
  if (filters.from) {
    conditions.push("created_at >= ?");
    params.push(filters.from);
  } else {
    // Default to 30 days ago if not specified
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);
    conditions.push("created_at >= ?");
    params.push(defaultFrom.toISOString());
  }
  
  if (filters.to) {
    // Use exclusive end for cleaner date boundaries
    const toDate = new Date(filters.to);
    toDate.setHours(23, 59, 59, 999);
    conditions.push("created_at < ?");
    params.push(toDate.toISOString());
  }
  
  if (filters.path && filters.path !== "both") {
    conditions.push("path = ?");
    params.push(filters.path);
  }
  
  if (filters.provider) {
    conditions.push("provider = ?");
    params.push(filters.provider);
  }
  
  if (filters.model) {
    conditions.push("model = ?");
    params.push(filters.model);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const dateFormat = bucket === "week" ? "strftime('%Y-W%W', created_at)" : "date(created_at)";
  
  // Single optimized SQL query with CTEs
  const rows = db.prepare(`
    WITH daily AS (
      SELECT
        ${dateFormat} AS day,
        savings_type,
        SUM(tokens_saved) AS tokens_saved,
        SUM(cost_saved_usd) AS cost_saved_usd,
        COUNT(*) AS rows,
        AVG(confidence) AS avg_confidence,
        COUNT(DISTINCT replay_id) AS replay_count
      FROM savings_ledger
      ${whereClause}
      GROUP BY day, savings_type
    ),
    pivot AS (
      SELECT
        day,
        -- VERIFIED (includes both "verified" + "shadow_verified")
        COALESCE(SUM(CASE WHEN savings_type IN ('verified','shadow_verified') THEN tokens_saved END), 0) AS verified_tokens_saved,
        COALESCE(SUM(CASE WHEN savings_type IN ('verified','shadow_verified') THEN cost_saved_usd END), 0) AS verified_cost_saved_usd,
        COALESCE(SUM(CASE WHEN savings_type IN ('verified','shadow_verified') THEN replay_count END), 0) AS verified_replays,
        -- ESTIMATED
        COALESCE(SUM(CASE WHEN savings_type = 'estimated' THEN tokens_saved END), 0) AS estimated_tokens_saved,
        COALESCE(SUM(CASE WHEN savings_type = 'estimated' THEN cost_saved_usd END), 0) AS estimated_cost_saved_usd,
        COALESCE(SUM(CASE WHEN savings_type = 'estimated' THEN rows END), 0) AS estimated_rows,
        COALESCE(AVG(CASE WHEN savings_type = 'estimated' THEN avg_confidence END), 0) AS estimated_avg_confidence,
        -- COMBINED
        COALESCE(SUM(tokens_saved), 0) AS combined_tokens_saved,
        COALESCE(SUM(cost_saved_usd), 0) AS combined_cost_saved_usd
      FROM daily
      GROUP BY day
    )
    SELECT
      day AS date,
      verified_tokens_saved,
      verified_cost_saved_usd,
      verified_replays AS verified_replays,
      estimated_tokens_saved,
      estimated_cost_saved_usd,
      estimated_rows,
      estimated_avg_confidence,
      combined_tokens_saved,
      combined_cost_saved_usd
    FROM pivot
    ORDER BY day ASC
  `).all(...params) as any[];
  
  return rows.map(row => {
    const conf = row.estimated_avg_confidence || 0;
    const confBand = conf >= 0.85 ? "high" : conf >= 0.70 ? "medium" : "low";
    
    return {
      date: row.date,
      verified: {
        tokens_saved: row.verified_tokens_saved || 0,
        cost_saved_usd: row.verified_cost_saved_usd || 0,
        replays: row.verified_replays || 0,
      },
      estimated: {
        tokens_saved: row.estimated_tokens_saved || 0,
        cost_saved_usd: row.estimated_cost_saved_usd || 0,
        rows: row.estimated_rows || 0,
        avg_confidence_band: confBand,
      },
      combined: {
        tokens_saved: row.combined_tokens_saved || 0,
        cost_saved_usd: row.combined_cost_saved_usd || 0,
      },
    };
  });
}

export function getSavingsByLevel(filters: SavingsFilters): LevelBreakdown[] {
  const db = getDb();
  const { sql: whereClause, params } = buildWhereClause(filters, "l");
  
  // Build path filter
  let ledgerWhere = whereClause;
  if (filters.path && filters.path !== "both") {
    ledgerWhere = ledgerWhere 
      ? `${ledgerWhere} AND l.path = ?`
      : `WHERE l.path = ?`;
    if (!ledgerWhere.includes("WHERE")) {
      params.push(filters.path);
    }
  }
  
  const rows = db.prepare(`
    SELECT 
      l.optimization_level as level,
      l.savings_type,
      COUNT(*) as count,
      SUM(tokens_saved) as tokens_saved,
      SUM(baseline_tokens) as baseline_tokens,
      SUM(cost_saved_usd) as cost_saved,
      AVG(CASE WHEN l.savings_type = 'estimated' THEN l.confidence ELSE NULL END) as avg_confidence
    FROM savings_ledger l
    ${ledgerWhere || ""}
    GROUP BY l.optimization_level, l.savings_type
    ORDER BY l.optimization_level ASC
  `).all(...(ledgerWhere ? params : [])) as any[];
  
  // Group by level
  const byLevel = new Map<number, {
    verified_count: number;
    estimated_count: number;
    verified_tokens_saved: number;
    estimated_tokens_saved: number;
    verified_cost_saved: number;
    estimated_cost_saved: number;
    verified_baseline_tokens: number;
    estimated_baseline_tokens: number;
    avg_confidence: number;
  }>();
  
  for (const row of rows) {
    if (!byLevel.has(row.level)) {
      byLevel.set(row.level, {
        verified_count: 0,
        estimated_count: 0,
        verified_tokens_saved: 0,
        estimated_tokens_saved: 0,
        verified_cost_saved: 0,
        estimated_cost_saved: 0,
        verified_baseline_tokens: 0,
        estimated_baseline_tokens: 0,
        avg_confidence: 0,
      });
    }
    
    const data = byLevel.get(row.level)!;
    const tokensSaved = row.tokens_saved || 0;
    const costSaved = row.cost_saved || 0;
    const baselineTokens = row.baseline_tokens || 0;
    
    if (row.savings_type === "verified" || row.savings_type === "shadow_verified") {
      data.verified_count += row.count || 0;
      data.verified_tokens_saved += tokensSaved;
      data.verified_cost_saved += costSaved;
      data.verified_baseline_tokens += baselineTokens;
    } else if (row.savings_type === "estimated") {
      data.estimated_count += row.count || 0;
      data.estimated_tokens_saved += tokensSaved;
      data.estimated_cost_saved += costSaved;
      data.estimated_baseline_tokens += baselineTokens;
      if (row.avg_confidence) {
        data.avg_confidence = row.avg_confidence;
      }
    }
  }
  
  // Get replay counts and confidence for each level
  const replayCounts = db.prepare(`
    SELECT 
      l.optimization_level as level,
      COUNT(DISTINCT l.replay_id) as replays
    FROM savings_ledger l
    WHERE l.savings_type IN ('verified', 'shadow_verified')
    ${ledgerWhere || ""}
    GROUP BY l.optimization_level
  `).all(...(ledgerWhere ? params : [])) as any[];
  
  const replayMap = new Map(replayCounts.map(r => [r.level, r.replays || 0]));
  
  const estimatedStats = db.prepare(`
    SELECT 
      l.optimization_level as level,
      COUNT(*) as rows,
      AVG(l.confidence) as avg_confidence
    FROM savings_ledger l
    WHERE l.savings_type = 'estimated'
    ${ledgerWhere || ""}
    GROUP BY l.optimization_level
  `).all(...(ledgerWhere ? params : [])) as any[];
  
  const estimatedMap = new Map(estimatedStats.map(r => [
    r.level,
    {
      rows: r.rows || 0,
      avg_confidence: r.avg_confidence || 0,
    }
  ]));
  
  return Array.from(byLevel.entries()).map(([level, data]) => {
    const totalTokensSaved = data.verified_tokens_saved + data.estimated_tokens_saved;
    const totalBaselineTokens = data.verified_baseline_tokens + data.estimated_baseline_tokens;
    const combinedPctSaved = totalBaselineTokens > 0 ? (totalTokensSaved / totalBaselineTokens) * 100 : 0;
    
    const vPctSaved = data.verified_baseline_tokens > 0 
      ? (data.verified_tokens_saved / data.verified_baseline_tokens) * 100 
      : 0;
    const ePctSaved = data.estimated_baseline_tokens > 0
      ? (data.estimated_tokens_saved / data.estimated_baseline_tokens) * 100
      : 0;
    
    const est = estimatedMap.get(level);
    const conf = est?.avg_confidence || data.avg_confidence || 0;
    const confBand = conf >= 0.85 ? "high" : conf >= 0.70 ? "medium" : "low";
    
    return {
      level,
      verified: {
        tokens_saved: data.verified_tokens_saved,
        cost_saved_usd: data.verified_cost_saved,
        replays: replayMap.get(level) || 0,
        pct_saved: vPctSaved,
      },
      estimated: {
        tokens_saved: data.estimated_tokens_saved,
        cost_saved_usd: data.estimated_cost_saved,
        rows: est?.rows || data.estimated_count,
        pct_saved: ePctSaved,
        avg_confidence_band: confBand,
      },
      combined: {
        tokens_saved: totalTokensSaved,
        cost_saved_usd: data.verified_cost_saved + data.estimated_cost_saved,
        pct_saved: combinedPctSaved,
      },
    };
  });
}

export function getSavingsByPath(filters: SavingsFilters): PathBreakdown[] {
  const db = getDb();
  const { sql: whereClause, params } = buildWhereClause(filters, "p");
  
  const rows = db.prepare(`
    SELECT 
      p.path,
      COUNT(DISTINCT p.replay_id) as replays,
      SUM(CASE WHEN r.mode = 'baseline' THEN r.usage_total_tokens ELSE 0 END) as baseline_tokens,
      SUM(CASE WHEN r.mode = 'optimized' THEN r.usage_total_tokens ELSE 0 END) as optimized_tokens,
      SUM(CASE WHEN r.mode = 'baseline' THEN r.cost_usd ELSE 0 END) as baseline_cost,
      SUM(CASE WHEN r.mode = 'optimized' THEN r.cost_usd ELSE 0 END) as optimized_cost
    FROM replays p
    JOIN runs r ON r.replay_id = p.replay_id
    ${whereClause}
    GROUP BY p.path
    ORDER BY p.path ASC
  `).all(...params) as any[];
  
  return rows.map(row => {
    const baselineTokens = row.baseline_tokens || 0;
    const optimizedTokens = row.optimized_tokens || 0;
    const tokensSaved = baselineTokens - optimizedTokens;
    const pctSaved = baselineTokens > 0 ? (tokensSaved / baselineTokens) * 100 : 0;
    
    const baselineCost = row.baseline_cost || 0;
    const optimizedCost = row.optimized_cost || 0;
    const costSaved = baselineCost - optimizedCost;
    
    return {
      path: row.path as "talk" | "code",
      replays: row.replays || 0,
      tokens_saved: tokensSaved,
      pct_saved: pctSaved,
      cost_saved_usd: costSaved,
    };
  });
}

export function getLevelUsageTimeseries(filters: SavingsFilters, bucket: "day" | "week" = "day"): Array<{ date: string; levels: Record<number, number> }> {
  const db = getDb();
  const { sql: whereClause, params } = buildWhereClause(filters, "p");
  
  const dateFormat = bucket === "week" ? "strftime('%Y-W%W', p.created_at)" : "date(p.created_at)";
  
  const rows = db.prepare(`
    SELECT 
      ${dateFormat} as date,
      p.optimization_level as level,
      COUNT(*) as count
    FROM replays p
    ${whereClause}
    GROUP BY ${dateFormat}, p.optimization_level
    ORDER BY date ASC, level ASC
  `).all(...params) as any[];
  
  // Group by date
  const byDate = new Map<string, Record<number, number>>();
  
  for (const row of rows) {
    if (!byDate.has(row.date)) {
      byDate.set(row.date, { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 });
    }
    const levels = byDate.get(row.date)!;
    levels[row.level] = row.count || 0;
  }
  
  return Array.from(byDate.entries()).map(([date, levels]) => ({ date, levels }));
}
