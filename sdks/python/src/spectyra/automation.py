from __future__ import annotations

import json
import threading
import urllib.request
from io import BytesIO
from typing import Any, Callable
from urllib.parse import urlparse
from urllib.response import addinfourl

from spectyra.monitor.engine import MonitorEngine
from spectyra.monitor.provider_detection import detect_provider_from_host
from spectyra.monitor.waste import build_waste_signals_http_auto

_MAX_BODY = 512_000

_engine: MonitorEngine | None = None
_orig_urlopen: Callable[..., Any] | None = None
_lock = threading.Lock()


def _should_record_path(pathname: str, provider: str) -> bool:
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


def _extract_openai_usage(body: dict[str, Any]) -> tuple[int, int]:
    u = body.get("usage")
    if not isinstance(u, dict):
        return 0, 0
    inp = int(u.get("prompt_tokens") or u.get("input_tokens") or 0)
    out = int(u.get("completion_tokens") or u.get("output_tokens") or 0)
    return inp, out


def _record_from_json(
    engine: MonitorEngine,
    *,
    host: str,
    pathname: str,
    method: str,
    status_code: int,
    latency_ms: int,
    body_text: str,
) -> None:
    try:
        provider = detect_provider_from_host(host)
        if provider == "unknown" or not _should_record_path(pathname, provider):
            return
        if len(body_text) > _MAX_BODY:
            return
        data = json.loads(body_text)
        if not isinstance(data, dict):
            return
        model = str(data.get("model") or "unknown")[:200]
        inp, out = _extract_openai_usage(data)
        cost = 0.0
        waste = build_waste_signals_http_auto(
            input_tokens=inp,
            output_tokens=out,
            latency_ms=latency_ms,
            actual_cost_usd=cost,
        )
        labels = engine.default_labels
        ev: dict[str, Any] = {
            "provider": provider,
            "model": model,
            "latencyMs": latency_ms,
            "success": 200 <= status_code < 400,
            "method": method,
            "statusCode": status_code,
            "urlHost": host,
            "route": pathname,
            "project": labels.get("project"),
            "environment": labels.get("environment"),
            "service": labels.get("service"),
            "pricingSource": "provider_usage" if (inp or out) else "unknown",
            "inputTokens": inp,
            "outputTokens": out,
            "totalTokens": inp + out,
            "actualCostUsd": cost,
            "integrationMode": "auto_http",
            "optimizerApplied": False,
            "optimizerStatus": "not_integrated",
        }
        if waste:
            ev["wasteSignals"] = waste
        engine.record_event(ev)
    except (json.JSONDecodeError, OSError, TypeError, ValueError):
        return


def _wrap_urlopen(orig: Callable[..., Any]) -> Callable[..., Any]:
    def inner(*args: Any, **kwargs: Any) -> Any:
        import time

        t0 = time.monotonic()
        resp = orig(*args, **kwargs)
        eng = _engine
        if eng is None:
            return resp

        req = args[0] if args else None
        if isinstance(req, urllib.request.Request):
            full = req.full_url
            method = req.get_method()
        else:
            full = str(req)
            method = "GET"
        parsed = urlparse(full)
        host = parsed.hostname or ""
        path = parsed.path or "/"

        try:
            body = resp.read()
        except Exception:
            return resp

        latency_ms = int(max(0, (time.monotonic() - t0) * 1000))
        status = getattr(resp, "status", None) or getattr(resp, "code", None) or 200
        try:
            status_i = int(status)
        except (TypeError, ValueError):
            status_i = 200
        headers = getattr(resp, "headers", None)
        fp = BytesIO(body)
        new_resp = addinfourl(fp, headers, full, status_i)  # type: ignore[arg-type]
        try:
            text = body.decode("utf-8", errors="replace")
            _record_from_json(
                eng,
                host=host,
                pathname=path,
                method=method,
                status_code=status_i,
                latency_ms=latency_ms,
                body_text=text,
            )
        except Exception:
            pass
        return new_resp

    return inner


def start_spectyra_auto(
    *,
    jsonl_path: str | None = None,
    jsonl_enabled: bool = True,
    project: str | None = None,
    environment: str | None = None,
    service: str | None = None,
) -> MonitorEngine:
    """Patch ``urllib.request.urlopen`` and expose a singleton :class:`MonitorEngine` (best-effort; idempotent)."""
    global _engine, _orig_urlopen
    with _lock:
        if _engine is not None:
            return _engine
        _engine = MonitorEngine(
            enabled=True,
            jsonl_path=jsonl_path,
            jsonl_enabled=jsonl_enabled,
            defaults={
                "project": project,
                "environment": environment,
                "service": service,
                "integrationMode": "auto_http",
            },
        )
        if _orig_urlopen is None:
            _orig_urlopen = urllib.request.urlopen
            urllib.request.urlopen = _wrap_urlopen(_orig_urlopen)  # type: ignore[method-assign]
        return _engine


def stop_spectyra_auto() -> None:
    global _engine, _orig_urlopen
    with _lock:
        if _orig_urlopen is not None:
            urllib.request.urlopen = _orig_urlopen  # type: ignore[method-assign]
            _orig_urlopen = None
        _engine = None


def get_auto_monitor_engine() -> MonitorEngine | None:
    return _engine
