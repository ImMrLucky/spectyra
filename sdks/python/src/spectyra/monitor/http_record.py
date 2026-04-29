"""Shared HTTP→monitor recording helpers (metadata-only)."""

from __future__ import annotations

import json
from typing import Any

from spectyra.monitor.provider_detection import detect_provider_from_host
from spectyra.monitor.waste import build_waste_signals_http_auto

_MAX_BODY = 512_000


def should_record_path(pathname: str, provider: str) -> bool:
    p = pathname.lower()
    if provider in ("openai", "groq", "azure-openai"):
        return "/chat/completions" in p or "/responses" in p
    if provider == "anthropic":
        return "/v1/messages" in p
    if provider == "google-gemini":
        return "/v1beta/" in p or "/v1/" in p
    if provider == "mistral":
        return "/v1/chat/completions" in p
    if provider in ("openrouter", "together"):
        return "/v1/chat/completions" in p
    if provider == "perplexity":
        return "/chat/completions" in p
    return False


def _extract_usage_tokens(body: dict[str, Any]) -> tuple[int, int]:
    u = body.get("usage")
    if isinstance(u, dict):
        inp = int(u.get("prompt_tokens") or u.get("input_tokens") or 0)
        out = int(u.get("completion_tokens") or u.get("output_tokens") or 0)
        if inp or out:
            return inp, out
    return 0, 0


def record_from_json_body(
    engine: Any,
    *,
    host: str,
    pathname: str,
    method: str,
    status_code: int,
    latency_ms: int,
    body_text: str,
    integration_mode: str,
    project: str | None = None,
    environment: str | None = None,
    service: str | None = None,
) -> None:
    try:
        record_event = getattr(engine, "record_event", None)
        if not callable(record_event):
            return
        provider = detect_provider_from_host(host)
        if provider == "unknown" or not should_record_path(pathname, provider):
            return
        if len(body_text) > _MAX_BODY:
            return
        data = json.loads(body_text)
        if not isinstance(data, dict):
            return
        model = str(data.get("model") or "unknown")[:200]
        inp, out = _extract_usage_tokens(data)
        cost = float(data.get("cost_usd") or 0.0) if isinstance(data.get("cost_usd"), (int, float)) else 0.0
        waste = build_waste_signals_http_auto(
            input_tokens=inp,
            output_tokens=out,
            latency_ms=latency_ms,
            actual_cost_usd=cost,
        )
        ev: dict[str, Any] = {
            "provider": provider,
            "model": model,
            "latencyMs": latency_ms,
            "success": 200 <= status_code < 400,
            "method": method,
            "statusCode": status_code,
            "urlHost": host,
            "route": pathname,
            "project": project,
            "environment": environment,
            "service": service,
            "pricingSource": "provider_usage" if (inp or out) else "unknown",
            "inputTokens": inp,
            "outputTokens": out,
            "totalTokens": inp + out,
            "actualCostUsd": cost,
            "integrationMode": integration_mode,
            "optimizerApplied": False,
            "optimizerStatus": "not_integrated",
        }
        if waste:
            ev["wasteSignals"] = waste
        record_event(ev)
    except (json.JSONDecodeError, OSError, TypeError, ValueError):
        return


def record_http_response_metadata_only(
    engine: Any,
    *,
    host: str,
    pathname: str,
    method: str,
    status_code: int,
    latency_ms: int,
    integration_mode: str,
    project: str | None = None,
    environment: str | None = None,
    service: str | None = None,
) -> None:
    """Streaming-safe: no body; token usage unknown."""
    try:
        record_event = getattr(engine, "record_event", None)
        if not callable(record_event):
            return
        provider = detect_provider_from_host(host)
        if provider == "unknown" or not should_record_path(pathname, provider):
            return
        waste = build_waste_signals_http_auto(
            input_tokens=0,
            output_tokens=0,
            latency_ms=latency_ms,
            actual_cost_usd=0.0,
        )
        ev: dict[str, Any] = {
            "provider": provider,
            "model": "unknown",
            "latencyMs": latency_ms,
            "success": 200 <= status_code < 400,
            "method": method,
            "statusCode": status_code,
            "urlHost": host,
            "route": pathname,
            "project": project,
            "environment": environment,
            "service": service,
            "pricingSource": "unknown",
            "inputTokens": 0,
            "outputTokens": 0,
            "totalTokens": 0,
            "actualCostUsd": 0.0,
            "integrationMode": integration_mode,
            "optimizerApplied": False,
            "optimizerStatus": "not_integrated",
        }
        if waste:
            ev["wasteSignals"] = waste
        record_event(ev)
    except (OSError, TypeError, ValueError):
        return
