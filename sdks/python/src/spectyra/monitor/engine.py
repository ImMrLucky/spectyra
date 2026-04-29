from __future__ import annotations

import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any

from spectyra.monitor.jsonl_writer import MonitorJsonlWriter
from spectyra.monitor.redaction import scrub_monitor_event_for_persistence
from spectyra.monitor.summaries import build_monitor_summary_from_events, empty_monitor_summary


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _new_event_id() -> str:
    return str(uuid.uuid4())


class MonitorEngine:
    """
    In-memory ring buffer + optional JSONL (metadata-only).
    Mirrors @spectyra/sdk createMonitorEngine behaviour at a high level.
    """

    def __init__(
        self,
        *,
        enabled: bool = True,
        buffer_max_events: int = 500,
        jsonl_path: str | None = None,
        jsonl_enabled: bool = True,
        jsonl_rotate_daily: bool = False,
        defaults: dict[str, Any] | None = None,
        logger: Any | None = None,
    ) -> None:
        self._enabled = enabled
        self._buffer: deque[dict[str, Any]] = deque(maxlen=buffer_max_events)
        self._defaults = defaults or {}
        self._log = logger
        self._jsonl: MonitorJsonlWriter | None = None
        if jsonl_enabled and jsonl_path:
            self._jsonl = MonitorJsonlWriter(jsonl_path, rotate_daily=jsonl_rotate_daily)

    @property
    def default_labels(self) -> dict[str, Any]:
        return dict(self._defaults)

    def record_event(self, partial: dict[str, Any]) -> None:
        if not self._enabled:
            return
        ev = {
            **partial,
            "eventId": partial.get("eventId") or _new_event_id(),
            "timestamp": partial.get("timestamp") or _iso_now(),
            "integrationMode": partial.get("integrationMode")
            or self._defaults.get("integrationMode")
            or "explicit_sdk",
            "sdkLanguage": partial.get("sdkLanguage") or "python",
            "project": partial.get("project") or self._defaults.get("project"),
            "environment": partial.get("environment") or self._defaults.get("environment"),
            "service": partial.get("service") or self._defaults.get("service"),
            "metadataOnly": True,
        }
        ev = scrub_monitor_event_for_persistence(ev)
        self._buffer.append(ev)
        if self._jsonl:
            self._jsonl.append(ev)

    def get_monitor_summary(self) -> dict[str, Any]:
        if not self._buffer:
            return empty_monitor_summary()
        return build_monitor_summary_from_events(list(self._buffer))

    def get_recent_monitor_events(self, limit: int = 50) -> list[dict[str, Any]]:
        lim = max(1, min(500, limit))
        return list(self._buffer)[-lim:]
