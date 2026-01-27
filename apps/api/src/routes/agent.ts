/**
 * Agent Control Plane Routes
 * 
 * Provides agent options and event streaming for SDK-first integration
 */

import { Router } from "express";
import { requireSpectyraApiKey, type AuthenticatedRequest } from "../middleware/auth.js";
import { decideAgentOptions } from "../services/agent/policy.js";
import { createAgentRun, insertAgentEvent } from "../services/agent/agentRepo.js";
import { safeLog } from "../utils/redaction.js";
import { randomUUID } from "node:crypto";

export const agentRouter = Router();

// Apply authentication middleware (machine auth via API key)
agentRouter.use(requireSpectyraApiKey);

/**
 * POST /v1/agent/options
 * 
 * Get agent options for a given prompt context
 * Server derives org/project from API key
 */
agentRouter.post("/options", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.context) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { run_id, prompt_meta, preferences } = req.body as {
      run_id?: string;
      prompt_meta: {
        promptChars: number;
        path?: "code" | "talk";
        repoId?: string;
        language?: string;
        filesChanged?: number;
        testCommand?: string;
      };
      preferences?: {
        budgetUsd?: number;
        allowTools?: string[];
      };
    };
    
    if (!prompt_meta || typeof prompt_meta.promptChars !== "number") {
      return res.status(400).json({ error: "prompt_meta.promptChars is required" });
    }
    
    // Get org/project from authenticated context
    const orgId = req.context.org.id;
    const projectId = req.context.project?.id || null;
    
    // Generate run_id if not provided
    const finalRunId = run_id || randomUUID();
    
    // Decide agent options using policy engine
    const decision = await decideAgentOptions({
      orgId,
      projectId,
      promptMeta: prompt_meta,
      preferences: preferences || {},
    });
    
    // Create agent run record
    await createAgentRun({
      runId: finalRunId,
      orgId,
      projectId,
      model: decision.options.model || "claude-3-5-sonnet-latest",
      maxBudgetUsd: decision.options.maxBudgetUsd || 2.5,
      allowedTools: decision.options.allowedTools || [],
      permissionMode: decision.options.permissionMode || "acceptEdits",
      promptMeta: prompt_meta,
      reasons: decision.reasons,
    });
    
    res.json({
      run_id: finalRunId,
      options: decision.options,
      reasons: decision.reasons,
    });
  } catch (error: any) {
    safeLog("error", "Agent options error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /v1/agent/events
 * 
 * Send agent event for telemetry
 */
agentRouter.post("/events", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.context) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { run_id, event } = req.body as {
      run_id: string;
      event: any;
    };
    
    if (!run_id) {
      return res.status(400).json({ error: "run_id is required" });
    }
    
    if (!event) {
      return res.status(400).json({ error: "event is required" });
    }
    
    // Get org from authenticated context
    const orgId = req.context.org.id;
    
    // Store event (best-effort, don't block on errors)
    try {
      await insertAgentEvent({
        runId: run_id,
        orgId,
        event,
      });
    } catch (eventError: any) {
      safeLog("warn", "Failed to store agent event", { 
        error: eventError.message,
        runId: run_id 
      });
      // Continue anyway - telemetry is best-effort
    }
    
    res.json({ ok: true });
  } catch (error: any) {
    safeLog("error", "Agent event error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
