"""Optional aiohttp instrumentation (metadata-only, streaming-safe)."""

from __future__ import annotations

import time
from typing import Any, Callable
from urllib.parse import urlparse

from spectyra.monitor.http_record import record_http_response_metadata_only


def install(get_engine: Callable[[], Any], defaults: dict[str, Any | None]) -> Callable[[], None]:
    try:
        from aiohttp.client import ClientSession
    except ImportError:
        return lambda: None

    orig = ClientSession._request

    async def wrapped(self: Any, method: str, str_or_url: Any, *args: Any, **kwargs: Any) -> Any:
        t0 = time.monotonic()
        resp = await orig(self, method, str_or_url, *args, **kwargs)
        eng = get_engine()
        if eng is None:
            return resp
        try:
            latency_ms = int(max(0, (time.monotonic() - t0) * 1000))
            url_s = str(str_or_url)
            if not url_s or url_s.startswith("/"):
                return resp
            if "://" not in url_s:
                url_s = "http://" + url_s
            parsed = urlparse(url_s)
            host = parsed.hostname or ""
            if not host:
                return resp
            path = parsed.path or "/"
            st = int(getattr(resp, "status", 0) or 0)
            record_http_response_metadata_only(
                eng,
                host=host,
                pathname=path,
                method=str(method).upper(),
                status_code=st,
                latency_ms=latency_ms,
                integration_mode="auto_provider_sdk",
                project=defaults.get("project"),
                environment=defaults.get("environment"),
                service=defaults.get("service"),
            )
        except Exception:
            pass
        return resp

    ClientSession._request = wrapped  # type: ignore[method-assign]

    def uninstall() -> None:
        ClientSession._request = orig  # type: ignore[method-assign]

    return uninstall
