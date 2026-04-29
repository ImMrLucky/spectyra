"""Cross-event waste hints (metadata-only), parity with @spectyra/sdk crossEventWaste."""

from __future__ import annotations

from typing import Any


def _djb2_hex(s: str) -> str:
    h = 5381
    for ch in s:
        h = ((h * 33) ^ ord(ch)) & 0xFFFFFFFF
    return format(h, "x")


def monitor_request_fingerprint(ev: dict[str, Any]) -> str:
    parts = [
        str(ev.get("provider") or ""),
        str(ev.get("model") or ""),
        str(ev.get("endpoint") or ev.get("route") or ""),
        str(ev.get("operationName") or ev.get("workflowType") or ""),
        str(ev.get("temperature") or ""),
        str(ev.get("maxTokens") or ""),
        str(ev.get("toolsEnabled") or ""),
        str(ev.get("toolCallCount") or ev.get("functionCallCount") or ""),
        str(ev.get("agentName") or ""),
        str(ev.get("toolName") or ""),
        str(ev.get("inputTokens") or 0),
        str(ev.get("outputTokens") or 0),
        str(ev.get("messageCount") or ""),
    ]
    return _djb2_hex("|".join(parts))


def _push(ev: dict[str, Any], sig: dict[str, Any]) -> None:
    ws = ev.setdefault("wasteSignals", [])
    if not isinstance(ws, list):
        return
    if any(x.get("type") == sig.get("type") and x.get("title") == sig.get("title") for x in ws if isinstance(x, dict)):
        return
    ws.append(sig)


def merge_cross_event_waste_into_event(prior: list[dict[str, Any]], ev: dict[str, Any]) -> None:
    fp = monitor_request_fingerprint(ev)
    same_fp = [e for e in prior if monitor_request_fingerprint(e) == fp]
    if len(same_fp) >= 1:
        _push(
            ev,
            {
                "type": "repeated_call",
                "severity": "warning" if len(same_fp) >= 3 else "info",
                "title": "Repeated request fingerprint",
                "description": (
                    "Multiple calls matched the same metadata fingerprint "
                    "(provider, model, endpoint shape, token counts). Consider caching or deduplicating work."
                ),
                "confidence": "medium",
                "groupKey": fp,
            },
        )
        _push(
            ev,
            {
                "type": "cache_opportunity",
                "severity": "info",
                "title": "Cache opportunity",
                "description": "Similar calls occurred in the recent window; a response cache may reduce spend.",
                "confidence": "low",
                "groupKey": fp,
            },
        )

    recent_fails = [
        e
        for e in prior
        if not e.get("success", True)
        and e.get("provider") == ev.get("provider")
        and (e.get("model") or "") == (ev.get("model") or "")
        and monitor_request_fingerprint(e) == fp
    ]
    if len(recent_fails) >= 2 and not ev.get("success", True):
        _push(
            ev,
            {
                "type": "retry_loop",
                "severity": "warning",
                "title": "Repeated failures",
                "description": (
                    "Multiple failed calls share the same fingerprint; check rate limits, auth, or model availability."
                ),
                "confidence": "medium",
            },
        )

    if ev.get("rateLimited") or any(
        e.get("rateLimited") and monitor_request_fingerprint(e) == fp for e in prior if isinstance(e, dict)
    ):
        _push(
            ev,
            {
                "type": "rate_limit_retries",
                "severity": "info",
                "title": "Rate limit pattern",
                "description": "Rate-limited responses detected for similar calls in this session.",
                "confidence": "low",
            },
        )

    if ev.get("agentName") and ev.get("toolName"):
        seq_key = f'{ev.get("agentName")}|{ev.get("toolName")}|{ev.get("provider")}|{ev.get("model") or ""}'
        similar = [
            e
            for e in prior
            if f'{e.get("agentName") or ""}|{e.get("toolName") or ""}|{e.get("provider")}|{e.get("model") or ""}'
            == seq_key
        ]
        if len(similar) >= 4:
            _push(
                ev,
                {
                    "type": "agent_loop",
                    "severity": "info",
                    "title": "Tight agent/tool loop",
                    "description": "Many events share the same agent, tool, provider, and model — possible loop.",
                    "confidence": "low",
                    "groupKey": _djb2_hex(seq_key),
                },
            )

    if int(ev.get("toolCallCount") or 0) >= 8 or int(ev.get("functionCallCount") or 0) >= 8:
        _push(
            ev,
            {
                "type": "tool_overuse",
                "severity": "warning",
                "title": "High tool call volume",
                "description": "Tool or function call counts are high on this row.",
                "confidence": "medium",
            },
        )

    rc = int(ev.get("retrievalChunkCount") or 0)
    inp = int(ev.get("inputTokens") or 0)
    if rc >= 12 and inp > 4000:
        _push(
            ev,
            {
                "type": "rag_overfetch",
                "severity": "info",
                "title": "RAG-heavy context",
                "description": "Many retrieval chunks with large prompt tokens — review chunking and top-k.",
                "confidence": "low",
            },
        )
