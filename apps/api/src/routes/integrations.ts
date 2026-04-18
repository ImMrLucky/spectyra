/**
 * Integrations Routes
 * 
 * Integration status and snippets
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { RL_STANDARD } from "../middleware/expressRateLimitPresets.js";
import { requireUserSession, type AuthenticatedRequest } from "../middleware/auth.js";
import { safeLog } from "../utils/redaction.js";
import { query, queryOne } from "../services/storage/db.js";
import { getIntegrationsPayload } from "@spectyra/integration-metadata";

export const integrationsRouter = Router();
integrationsRouter.use(rateLimit(RL_STANDARD));

/**
 * GET /v1/integrations
 *
 * Full integration framework metadata (scenarios, pages, OpenClaw snippet, trust labels).
 * Public — no auth required so docs and static generators can fetch it.
 */
integrationsRouter.get("/", (_req, res) => {
  res.json(getIntegrationsPayload());
});

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
 * GET /v1/integrations/metadata
 *
 * Structured integration card metadata for the Integrations page.
 * Describes each integration path with security/data-flow info.
 */
integrationsRouter.get("/metadata", (_req, res) => {
  res.json([
    {
      id: "local-companion",
      name: "Desktop App / Local Companion",
      category: "local-companion",
      recommended: true,
      requiresCodeChanges: false,
      runsWhere: "Your machine (localhost)",
      promptLeavesEnvironmentByDefault: false,
      providerCallPath: "direct_provider",
      telemetryDefault: "local",
      promptSnapshotDefault: "local_only",
      recommendedFirstMode: "observe",
      securityNotes: [
        "Prompts and responses stay on your machine",
        "Provider calls go directly from your machine to the provider",
        "No Spectyra cloud relay for inference",
        "Provider key never leaves your machine",
      ],
      setupSteps: [
        "Download and install the Spectyra Desktop App",
        "Enter your provider API key (stored locally, never uploaded)",
        "Choose run mode (observe recommended to start)",
        "In your LLM app's settings, change the API endpoint to http://127.0.0.1:4111/v1",
        "Run a test and verify savings",
      ],
      verificationSteps: [
        'Open the Desktop App savings dashboard',
        'Confirm inference path shows "Direct to provider"',
        'Confirm telemetry shows "Local only"',
        "Run a prompt and check the before/after comparison",
      ],
    },
    {
      id: "sdk-wrapper",
      name: "SDK Wrapper",
      category: "sdk-wrapper",
      recommended: true,
      requiresCodeChanges: true,
      runsWhere: "Your application process",
      promptLeavesEnvironmentByDefault: false,
      providerCallPath: "direct_provider",
      telemetryDefault: "local",
      promptSnapshotDefault: "local_only",
      recommendedFirstMode: "observe",
      securityNotes: [
        "Optimization runs in your process",
        "Your provider SDK client makes the actual LLM call",
        "Provider key stays in your environment",
        "Reports are emitted locally; cloud sync is opt-in",
      ],
      setupSteps: [
        "Install @spectyra/sdk or @spectyra/agents",
        "Wrap your provider call with spectyra.complete()",
        'Set runMode to "observe" to start',
        "Review the SavingsReport returned with each call",
      ],
      verificationSteps: [
        'Check SavingsReport.inferencePath is "direct_provider"',
        'Check SavingsReport.providerBillingOwner is "customer"',
        "Confirm no network calls to Spectyra servers during inference",
      ],
    },
    {
      id: "observe-preview",
      name: "Observe / Preview",
      category: "observe-preview",
      recommended: false,
      requiresCodeChanges: false,
      runsWhere: "Spectyra website (dry-run)",
      promptLeavesEnvironmentByDefault: false,
      providerCallPath: "direct_provider",
      telemetryDefault: "local",
      promptSnapshotDefault: "local_only",
      recommendedFirstMode: "observe",
      securityNotes: [
        "No provider call is made",
        "Savings are projected, not realized",
        "No provider key required",
      ],
      setupSteps: [
        "Open Spectyra Studio or Observe page",
        "Paste or select a sample prompt",
        "View projected savings",
      ],
      verificationSteps: [
        'Confirm "No provider call made" label is visible',
        "Review before/after prompt comparison",
      ],
    },
    {
      id: "legacy-remote-gateway",
      name: "Legacy Remote Gateway",
      category: "legacy-remote-gateway",
      recommended: false,
      requiresCodeChanges: true,
      runsWhere: "Spectyra cloud",
      promptLeavesEnvironmentByDefault: true,
      providerCallPath: "legacy_remote_gateway",
      telemetryDefault: "cloud_redacted",
      promptSnapshotDefault: "cloud_opt_in",
      recommendedFirstMode: "on",
      securityNotes: [
        "DEPRECATED — prompts are routed through Spectyra servers",
        "Use SDK Wrapper or Local Companion instead",
      ],
      setupSteps: [
        "Point your application to the Spectyra /v1/chat endpoint",
        "Set X-SPECTYRA-API-KEY and X-PROVIDER-KEY headers",
      ],
      verificationSteps: [
        "Confirm the response includes optimization metadata",
      ],
    },
  ]);
});

/**
 * GET /v1/integrations/snippets
 *
 * Legacy code snippets (backward compatibility)
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
