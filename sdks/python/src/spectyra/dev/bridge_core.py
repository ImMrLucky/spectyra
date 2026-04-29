"""HTTP handlers for local dev monitor bridge (JSON + SSE)."""

from __future__ import annotations

import json
import os
import time
from typing import Any, Iterator

DEFAULT_PREFIX = "/__spectyra"


def is_dev_bridge_enabled() -> bool:
    if os.environ.get("SPECTYRA_DEV_BRIDGE", "").lower() == "false":
        return False
    if os.environ.get("SPECTYRA_DEV_BRIDGE", "").lower() == "true":
        return True
    return os.environ.get("ENVIRONMENT", os.environ.get("NODE_ENV", "development")).lower() not in (
        "production",
        "prod",
    )


def _norm_prefix(prefix: str) -> str:
    p = (prefix or DEFAULT_PREFIX).rstrip("/") or DEFAULT_PREFIX
    return p if p.startswith("/") else f"/{p}"


def _host_allowed(host_header: str | None, allowed: list[str] | None) -> bool:
    if not allowed:
        return True
    h = (host_header or "").split(":")[0].strip().lower()
    return h in {x.split(":")[0].strip().lower() for x in allowed}


def _get_engine(spectyra: Any) -> Any:
    mon = getattr(spectyra, "monitor", None)
    return mon


def handle_monitor_request(
    method: str,
    path: str,
    query: str,
    headers: dict[str, str],
    spectyra: Any,
    *,
    route_prefix: str = DEFAULT_PREFIX,
    allowed_hosts: list[str] | None = None,
    token: str | None = None,
    sse_enabled: bool = True,
) -> tuple[int, dict[str, str], bytes | Iterator[bytes]]:
    """
    Returns (status, headers, body_or_iterator).
    For SSE, body is an iterator of bytes chunks.
    """
    rp = _norm_prefix(route_prefix)
    p = path.split("?", 1)[0]
    if not p.startswith(f"{rp}/") and p != rp:
        return 404, {"Content-Type": "text/plain"}, b"not found"

    if not is_dev_bridge_enabled():
        return 404, {"Content-Type": "application/json"}, json.dumps({"error": "dev_bridge_disabled"}).encode()

    if not _host_allowed(headers.get("host"), allowed_hosts):
        return 403, {"Content-Type": "application/json"}, json.dumps({"error": "host_not_allowed"}).encode()

    if token:
        auth = headers.get("authorization", "")
        ok = auth == f"Bearer {token}"
        if not ok and query:
            try:
                from urllib.parse import parse_qs

                q = parse_qs(query)
                ok = (q.get("token") or [None])[0] == token
            except Exception:
                ok = False
        if not ok:
            return 401, {"Content-Type": "application/json"}, json.dumps({"error": "unauthorized"}).encode()

    eng = _get_engine(spectyra)
    if eng is None:
        return 503, {"Content-Type": "application/json"}, json.dumps({"error": "monitor_engine_unavailable"}).encode()

    cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    m = method.upper()
    if m == "OPTIONS":
        return 204, cors, b""

    if m != "GET":
        return 405, {**cors, "Content-Type": "application/json"}, json.dumps({"error": "method_not_allowed"}).encode()

    from spectyra.monitor.aggregates import aggregate_all_monitor_views

    snap_fn = getattr(eng, "get_events_snapshot", None)
    snap: list[dict[str, Any]] = list(snap_fn()) if callable(snap_fn) else []

    if p in (f"{rp}/summary", f"{rp}/monitor/summary"):
        body = json.dumps(eng.get_monitor_summary()).encode()
        return 200, {**cors, "Content-Type": "application/json; charset=utf-8"}, body

    if p in (f"{rp}/events", f"{rp}/monitor/events"):
        limit = 50
        if query:
            try:
                from urllib.parse import parse_qs

                lim = (parse_qs(query).get("limit") or ["50"])[0]
                limit = max(1, min(500, int(lim)))
            except Exception:
                pass
        body = json.dumps(eng.get_recent_monitor_events(limit)).encode()
        return 200, {**cors, "Content-Type": "application/json; charset=utf-8"}, body

    if p == f"{rp}/waste":
        agg = aggregate_all_monitor_views(snap)
        payload = {"waste": agg["waste"], "views": {"repeated": agg["repeated"][:50], "cache": agg["cache"][:50]}}
        return 200, {**cors, "Content-Type": "application/json; charset=utf-8"}, json.dumps(payload).encode()

    if p == f"{rp}/stream":
        if not sse_enabled:
            return 404, {**cors, "Content-Type": "application/json"}, json.dumps({"error": "sse_disabled"}).encode()

        def gen() -> Iterator[bytes]:
            while True:
                try:
                    snap2 = list(snap_fn()) if callable(snap_fn) else []
                    agg = aggregate_all_monitor_views(snap2)
                    payload = json.dumps(
                        {
                            "summary": eng.get_monitor_summary(),
                            "waste": agg["waste"],
                            "eventTail": eng.get_recent_monitor_events(20),
                        }
                    )
                    yield f"data: {payload}\n\n".encode()
                except Exception:
                    yield b"data: {}\n\n"
                time.sleep(0.5)

        hdrs = {
            **cors,
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
        }
        return 200, hdrs, gen()

    return 404, {**cors, "Content-Type": "application/json"}, json.dumps({"error": "not_found", "path": p}).encode()
