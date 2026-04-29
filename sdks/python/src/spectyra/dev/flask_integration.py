"""Flask blueprint for local Spectyra monitor dev bridge."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from spectyra.dev.bridge_core import DEFAULT_PREFIX, handle_monitor_request


def create_spectyra_blueprint(
    spectyra: Any,
    *,
    route_prefix: str = DEFAULT_PREFIX,
    allowed_hosts: list[str] | None = None,
    token: str | None = None,
    sse_enabled: bool = True,
) -> Any:
    try:
        from flask import Blueprint, Response, request, stream_with_context
    except ImportError as e:  # pragma: no cover
        raise ImportError('create_spectyra_blueprint requires the "flask" package.') from e

    bp = Blueprint("spectyra_dev", __name__)

    def _go() -> Any:
        hdrs = {k: v for k, v in request.headers.items()}
        st, h, body = handle_monitor_request(
            request.method,
            request.path,
            request.query_string.decode() or "",
            hdrs,
            spectyra,
            route_prefix=route_prefix,
            allowed_hosts=allowed_hosts,
            token=token,
            sse_enabled=sse_enabled,
        )
        if isinstance(body, Iterator) and not isinstance(body, (bytes, bytearray)):
            return Response(
                stream_with_context(body),
                status=st,
                headers=h,
                mimetype="text/event-stream",
            )
        return Response(body, status=st, headers=h)

    @bp.route("/summary", methods=["GET", "OPTIONS"])
    @bp.route("/events", methods=["GET", "OPTIONS"])
    @bp.route("/waste", methods=["GET", "OPTIONS"])
    @bp.route("/stream", methods=["GET", "OPTIONS"])
    @bp.route("/monitor/summary", methods=["GET", "OPTIONS"])
    @bp.route("/monitor/events", methods=["GET", "OPTIONS"])
    def _routes() -> Any:
        return _go()

    return bp


__all__ = ["create_spectyra_blueprint"]
