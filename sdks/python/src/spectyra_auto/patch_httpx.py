"""Patch ``httpx`` sync and async clients (optional dependency)."""

from __future__ import annotations

import functools
import time
from typing import Any, Callable
from urllib.parse import urlparse

from spectyra.monitor.http_record import record_from_json_body


def _record_safe(
    eng: Any,
    method: str,
    url: str,
    status_code: int,
    latency_ms: int,
    text: str,
    defaults: dict[str, Any | None],
) -> None:
    try:
        parsed = urlparse(url)
        host = parsed.hostname or ""
        path = parsed.path or "/"
        record_from_json_body(
            eng,
            host=host,
            pathname=path,
            method=str(method).upper(),
            status_code=status_code,
            latency_ms=latency_ms,
            body_text=text,
            integration_mode="auto_provider_sdk",
            project=defaults.get("project"),
            environment=defaults.get("environment"),
            service=defaults.get("service"),
        )
    except Exception:
        pass


def install(get_engine: Callable[[], Any], defaults: dict[str, Any | None]) -> Callable[[], None]:
    try:
        import httpx
    except ImportError:
        return lambda: None

    uninstallers: list[Callable[[], None]] = []

    orig_sync = httpx.Client.request

    @functools.wraps(orig_sync)
    def sync_request(self: Any, method: str, url: Any, **kwargs: Any) -> Any:  # type: ignore[no-untyped-def]
        t0 = time.monotonic()
        r = orig_sync(self, method, url, **kwargs)
        eng = get_engine()
        if eng is not None:
            latency_ms = int(max(0, (time.monotonic() - t0) * 1000))
            try:
                text = r.text or ""
            except Exception:
                text = ""
            _record_safe(eng, method, str(r.request.url), int(r.status_code), latency_ms, text, defaults)
        return r

    httpx.Client.request = sync_request  # type: ignore[method-assign]

    def u1() -> None:
        httpx.Client.request = orig_sync  # type: ignore[method-assign]

    uninstallers.append(u1)

    if hasattr(httpx, "AsyncClient"):
        orig_async = httpx.AsyncClient.request

        @functools.wraps(orig_async)
        async def async_request(self: Any, method: str, url: Any, **kwargs: Any) -> Any:  # type: ignore[no-untyped-def]
            t0 = time.monotonic()
            r = await orig_async(self, method, url, **kwargs)
            eng = get_engine()
            if eng is not None:
                latency_ms = int(max(0, (time.monotonic() - t0) * 1000))
                try:
                    text = r.text or ""
                except Exception:
                    text = ""
                _record_safe(eng, method, str(r.request.url), int(r.status_code), latency_ms, text, defaults)
            return r

        httpx.AsyncClient.request = async_request  # type: ignore[method-assign]

        def u2() -> None:
            httpx.AsyncClient.request = orig_async  # type: ignore[method-assign]

        uninstallers.append(u2)

    def uninstall() -> None:
        for fn in uninstallers:
            fn()

    return uninstall
