from __future__ import annotations

import threading
import urllib.request
from io import BytesIO
from typing import Any, Callable
from urllib.parse import urlparse
from urllib.response import addinfourl

from spectyra.monitor.engine import MonitorEngine
from spectyra.monitor.http_record import record_from_json_body

_engine: MonitorEngine | None = None
_orig_urlopen: Callable[..., Any] | None = None
_lock = threading.Lock()


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
            labels = eng.default_labels
            record_from_json_body(
                eng,
                host=host,
                pathname=path,
                method=method,
                status_code=status_i,
                latency_ms=latency_ms,
                body_text=text,
                integration_mode="auto_http",
                project=labels.get("project"),
                environment=labels.get("environment"),
                service=labels.get("service"),
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
