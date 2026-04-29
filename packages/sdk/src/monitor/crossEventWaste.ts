import type { SpectyraMonitorEvent, SpectyraWasteSignal } from "./monitorTypes.js";

function djb2Hex(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h, 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

/** Metadata-only fingerprint (no prompt content). */
export function monitorRequestFingerprint(ev: SpectyraMonitorEvent): string {
  const parts = [
    ev.provider,
    ev.model ?? "",
    ev.endpoint ?? ev.route ?? "",
    ev.operationName ?? ev.workflowType ?? "",
    String(ev.temperature ?? ""),
    String(ev.maxTokens ?? ""),
    String(ev.toolsEnabled ?? ""),
    String(ev.toolCallCount ?? ev.functionCallCount ?? ""),
    String(ev.agentName ?? ""),
    String(ev.toolName ?? ""),
    String(ev.inputTokens ?? 0),
    String(ev.outputTokens ?? 0),
    String(ev.messageCount ?? ""),
  ];
  return djb2Hex(parts.join("|"));
}

function push(ev: SpectyraMonitorEvent, s: SpectyraWasteSignal): void {
  if (!ev.wasteSignals) ev.wasteSignals = [];
  if (ev.wasteSignals.some((x) => x.type === s.type && x.title === s.title)) return;
  ev.wasteSignals.push(s);
}

/**
 * Adds cross-event waste hints by scanning prior buffer rows (metadata only).
 * Mutates `ev.wasteSignals` in place.
 */
export function mergeCrossEventWasteIntoEvent(prior: SpectyraMonitorEvent[], ev: SpectyraMonitorEvent): void {
  const fp = monitorRequestFingerprint(ev);
  const sameFp = prior.filter((e) => monitorRequestFingerprint(e) === fp);
  if (sameFp.length >= 1) {
    push(ev, {
      type: "repeated_call",
      severity: sameFp.length >= 3 ? "warning" : "info",
      title: "Repeated request fingerprint",
      description:
        "Multiple calls matched the same metadata fingerprint (provider, model, endpoint shape, token counts). Consider caching or deduplicating work.",
      confidence: "medium",
      groupKey: fp,
    });
    push(ev, {
      type: "cache_opportunity",
      severity: "info",
      title: "Cache opportunity",
      description: "Similar calls occurred in the recent window; a response cache may reduce spend.",
      confidence: "low",
      groupKey: fp,
    });
  }

  const recentFails = prior.filter(
    (e) =>
      !e.success &&
      e.provider === ev.provider &&
      (e.model ?? "") === (ev.model ?? "") &&
      monitorRequestFingerprint(e) === fp,
  );
  if (recentFails.length >= 2 && ev.success === false) {
    push(ev, {
      type: "retry_loop",
      severity: "warning",
      title: "Repeated failures",
      description: "Multiple failed calls share the same fingerprint; check rate limits, auth, or model availability.",
      confidence: "medium",
    });
  }

  if (ev.rateLimited || prior.some((e) => e.rateLimited && monitorRequestFingerprint(e) === fp)) {
    push(ev, {
      type: "rate_limit_retries",
      severity: "info",
      title: "Rate limit pattern",
      description: "Rate-limited responses detected for similar calls in this session.",
      confidence: "low",
    });
  }

  if (ev.agentName && ev.toolName) {
    const seqKey = `${ev.agentName}|${ev.toolName}|${ev.provider}|${ev.model ?? ""}`;
    const similar = prior.filter(
      (e) => `${e.agentName ?? ""}|${e.toolName ?? ""}|${e.provider}|${e.model ?? ""}` === seqKey,
    );
    if (similar.length >= 4) {
      push(ev, {
        type: "agent_loop",
        severity: "info",
        title: "Tight agent/tool loop",
        description: "Many events share the same agent, tool, provider, and model — possible loop.",
        confidence: "low",
        groupKey: djb2Hex(seqKey),
      });
    }
  }

  if ((ev.toolCallCount ?? 0) >= 8 || (ev.functionCallCount ?? 0) >= 8) {
    push(ev, {
      type: "tool_overuse",
      severity: "warning",
      title: "High tool call volume",
      description: "Tool or function call counts are high on this row.",
      confidence: "medium",
    });
  }

  const rc = ev.retrievalChunkCount ?? 0;
  const inp = ev.inputTokens ?? 0;
  if (rc >= 12 && inp > 4000) {
    push(ev, {
      type: "rag_overfetch",
      severity: "info",
      title: "RAG-heavy context",
      description: "Many retrieval chunks with large prompt tokens — review chunking and top-k.",
      confidence: "low",
    });
  }
}
