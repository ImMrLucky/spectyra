/**
 * Integrations Routes
 * 
 * Integration status and snippets
 */

import { Router } from "express";
import { requireUserSession, type AuthenticatedRequest } from "../middleware/auth.js";
import { safeLog } from "../utils/redaction.js";
import { query, queryOne } from "../services/storage/db.js";

export const integrationsRouter = Router();

/**
 * GET /v1/integrations/status
 * 
 * Get integration status for the authenticated org
 * Shows which integration types are active and last activity
 */
integrationsRouter.get("/status", async (req: AuthenticatedRequest, res) => {
  try {
    // Try Supabase JWT first
    const authHeader = req.headers.authorization;
    let orgId: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      // Use requireUserSession pattern
      let jwtAuthSucceeded = false;
      let middlewareCompleted = false;
      
      const { requireUserSession } = await import("../middleware/auth.js");
      
      await new Promise<void>((resolve) => {
        const nextCallback = () => {
          jwtAuthSucceeded = true;
          middlewareCompleted = true;
          resolve();
        };
        
        requireUserSession(req, res, nextCallback)
          .then(() => {
            if (!middlewareCompleted) {
              middlewareCompleted = true;
              resolve();
            }
          })
          .catch(() => {
            middlewareCompleted = true;
            resolve();
          });
      });
      
      if (jwtAuthSucceeded && !res.headersSent && req.auth?.userId) {
        const membership = await queryOne<{ org_id: string }>(`
          SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
        `, [req.auth.userId]);
        
        if (membership) {
          orgId = membership.org_id;
        }
      }
      
      if (res.headersSent) {
        return;
      }
    }

    if (!orgId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Check for agent runs (SDK usage)
    const agentRuns = await query(`
      SELECT MAX(created_at) as last_run_at
      FROM agent_runs
      WHERE org_id = $1
    `, [orgId]);

    // Check for agent events (SDK remote mode)
    const agentEvents = await query(`
      SELECT MAX(ae.created_at) as last_event_at
      FROM agent_events ae
      JOIN agent_runs ar ON ar.id = ae.run_id
      WHERE ar.org_id = $1
    `, [orgId]);

    // Check for chat runs (API gateway usage)
    const chatRuns = await query(`
      SELECT MAX(created_at) as last_run_at
      FROM runs
      WHERE org_id = $1
    `, [orgId]);

    const lastAgentRun = agentRuns.rows[0]?.last_run_at || null;
    const lastAgentEvent = agentEvents.rows[0]?.last_event_at || null;
    const lastChatRun = chatRuns.rows[0]?.last_run_at || null;

    // Determine integration status
    const hasAgentRuns = !!lastAgentRun;
    const hasAgentEvents = !!lastAgentEvent;
    const hasChatRuns = !!lastChatRun;

    // SDK-local: has agent runs but no events (or events are local-only)
    const sdk_local = hasAgentRuns && !hasAgentEvents;
    
    // SDK-remote: has agent events (means API mode is being used)
    const sdk_remote = hasAgentEvents;
    
    // API: has chat runs through /v1/chat endpoint
    const api = hasChatRuns;

    // Get most recent activity
    const allDates = [lastAgentRun, lastAgentEvent, lastChatRun].filter(Boolean);
    const lastRunAt = allDates.length > 0 
      ? new Date(Math.max(...allDates.map(d => new Date(d).getTime()))).toISOString()
      : null;

    const lastEventAt = lastAgentEvent || null;

    res.json({
      sdk_local,
      sdk_remote,
      api,
      last_event_at: lastEventAt,
      last_run_at: lastRunAt,
    });
  } catch (error: any) {
    safeLog("error", "Get integration status error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/integrations/snippets
 * 
 * Get integration code snippets (existing endpoint, keep for backward compatibility)
 */
integrationsRouter.get("/snippets", async (req, res) => {
  try {
    // Return static snippets (can be enhanced later)
    res.json({
      hosted_gateway: {
        curl: `curl -X POST https://spectyra.up.railway.app/v1/chat \\
  -H "Content-Type: application/json" \\
  -H "X-SPECTYRA-API-KEY: your-spectyra-key" \\
  -H "X-PROVIDER-KEY: your-provider-key" \\
  -d '{
    "path": "code",
    "provider": "openai",
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`,
        node: `const response = await fetch('https://spectyra.up.railway.app/v1/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-SPECTYRA-API-KEY': 'your-spectyra-key',
    'X-PROVIDER-KEY': 'your-provider-key'
  },
  body: JSON.stringify({
    path: 'code',
    provider: 'openai',
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello' }]
  })
});`
      },
      proxy: {
        env: `export SPECTYRA_API_URL=https://spectyra.up.railway.app/v1
export SPECTYRA_API_KEY=your-spectyra-key
export OPENAI_API_KEY=your-openai-key`,
        command: `npm install -g spectyra-proxy
spectyra-proxy`
      },
      sdk: {
        usage: `import { createSpectyra } from "@spectyra/sdk";
const spectyra = createSpectyra({ mode: "local" });`
      }
    });
  } catch (error: any) {
    safeLog("error", "Get snippets error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
