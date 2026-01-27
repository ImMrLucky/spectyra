/**
 * Remote Agent Client
 * 
 * Handles agent-related API calls (options, events)
 */

import type { 
  SpectyraCtx, 
  PromptMeta, 
  AgentOptionsRequest, 
  AgentOptionsResponse,
  AgentEventRequest,
  AgentEventResponse 
} from "../types.js";
import { postJson } from "./http.js";

/**
 * Fetch agent options from remote API
 */
export async function fetchAgentOptions(
  endpoint: string,
  apiKey: string,
  ctx: SpectyraCtx,
  promptMeta: PromptMeta
): Promise<AgentOptionsResponse> {
  const url = `${endpoint}/agent/options`;
  
  const request: AgentOptionsRequest = {
    run_id: ctx.runId,
    prompt_meta: promptMeta,
    preferences: {
      budgetUsd: ctx.budgetUsd,
      // allowTools can be added if needed
    },
  };
  
  return postJson<AgentOptionsResponse>(url, apiKey, request);
}

/**
 * Send agent event to remote API
 */
export async function sendAgentEvent(
  endpoint: string,
  apiKey: string,
  ctx: SpectyraCtx,
  event: any
): Promise<AgentEventResponse> {
  if (!ctx.runId) {
    throw new Error("runId is required to send agent events");
  }
  
  const url = `${endpoint}/agent/events`;
  
  // Truncate large events (max 256KB JSON)
  let eventToSend = event;
  const eventJson = JSON.stringify(event);
  if (eventJson.length > 256 * 1024) {
    // Store only type + summary for large events
    eventToSend = {
      type: event.type || "unknown",
      summary: "Event truncated (exceeds 256KB)",
      originalSize: eventJson.length,
      timestamp: new Date().toISOString(),
    };
  }
  
  const request: AgentEventRequest = {
    run_id: ctx.runId,
    event: eventToSend,
  };
  
  return postJson<AgentEventResponse>(url, apiKey, request);
}
