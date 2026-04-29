"""Patch ``requests.sessions.Session.request`` for metadata-only monitor rows."""

from __future__ import annotations

import time
from typing import Any, Callable
from urllib.parse import urlparse

from spectyra.monitor.http_record import record_from_json_body


def install(get_engine: Callable[[], Any], defaults: dict[str, Any | None]) -> Callable[[], None]:
    try:
        import requests
    except ImportError:
        return lambda: None

    Session = requests.sessions.Session
    orig = Session.request

    def wrapped(self: Any, method: str, url: str | bytes, **kwargs: Any) -> Any:  # type: ignore[no-untyped-def]
        t0 = time.monotonic()
        resp = orig(self, method, url, **kwargs)
        eng = get_engine()
        if eng is None:
            return resp
        try:
            u = str(url)
            parsed = urlparse(u)
            host = parsed.hostname or ""
            path = parsed.path or "/"
            latency_ms = int(max(0, (time.monotonic() - t0) * 1000))
            st = int(getattr(resp, "status_code", 0) or 0)
            text = resp.text or ""
            record_from_json_body(
                eng,
                host=host,
                pathname=path,
                method=str(method).upper(),
                status_code=st,
                latency_ms=latency_ms,
                body_text=text,
                integration_mode="auto_provider_sdk",
                project=defaults.get("project"),
                environment=defaults.get("environment"),
                service=defaults.get("service"),
            )
        except Exception:
            pass
        return resp

    Session.request = wrapped  # type: ignore[method-assign]

    def uninstall() -> None:
        Session.request = orig  # type: ignore[method-assign]

    return uninstall
