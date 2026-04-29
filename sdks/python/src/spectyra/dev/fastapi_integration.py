"""FastAPI router for local Spectyra monitor dev bridge."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from spectyra.dev.bridge_core import DEFAULT_PREFIX, handle_monitor_request


def spectyra_router(
    spectyra: Any,
    *,
    route_prefix: str = DEFAULT_PREFIX,
    allowed_hosts: list[str] | None = None,
    token: str | None = None,
    sse_enabled: bool = True,
) -> Any:
    try:
        from fastapi import APIRouter, Request
        from fastapi.responses import Response, StreamingResponse
    except ImportError as e:  # pragma: no cover
        raise ImportError('spectyra_router requires the "fastapi" package. pip install "spectyra[dev]"') from e

    router = APIRouter()

    def _hdrs(request: Request) -> dict[str, str]:
        return {str(k): str(v) for k, v in request.headers.items()}

    def _dispatch(request: Request) -> Response:
        path = str(request.url.path)
        q = str(request.url.query)
        st, h, body = handle_monitor_request(
            request.method,
            path,
            q,
            _hdrs(request),
            spectyra,
            route_prefix=route_prefix,
            allowed_hosts=allowed_hosts,
            token=token,
            sse_enabled=sse_enabled,
        )
        if isinstance(body, Iterator) and not isinstance(body, (bytes, bytearray, str)):
            return StreamingResponse(body, status_code=st, headers=h)  # type: ignore[arg-type, return-value]
        b = body if isinstance(body, (bytes, bytearray)) else bytes(body)
        return Response(content=b, status_code=st, headers=h)

    @router.api_route("/summary", methods=["GET", "OPTIONS"])
    async def summary(request: Request) -> Response:
        return _dispatch(request)

    @router.api_route("/events", methods=["GET", "OPTIONS"])
    async def events(request: Request) -> Response:
        return _dispatch(request)

    @router.api_route("/waste", methods=["GET", "OPTIONS"])
    async def waste(request: Request) -> Response:
        return _dispatch(request)

    @router.api_route("/monitor/summary", methods=["GET", "OPTIONS"])
    async def legacy_summary(request: Request) -> Response:
        return _dispatch(request)

    @router.api_route("/monitor/events", methods=["GET", "OPTIONS"])
    async def legacy_events(request: Request) -> Response:
        return _dispatch(request)

    @router.api_route("/stream", methods=["GET", "OPTIONS"])
    async def stream(request: Request) -> Response:
        return _dispatch(request)

    return router


__all__ = ["spectyra_router"]
