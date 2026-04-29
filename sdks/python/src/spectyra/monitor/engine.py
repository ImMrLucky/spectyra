from __future__ import annotations

import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any

from spectyra.monitor.aggregates import (
    aggregate_all_monitor_views,
    get_cache_opportunities_from_events,
    get_endpoint_breakdown_from_events,
    get_environment_breakdown_from_events,
    get_expensive_calls_from_events,
    get_missed_savings_summary_from_events,
    get_model_breakdown_from_events,
    get_optimizer_quota_summary_from_events,
    get_provider_breakdown_from_events,
    get_repeated_calls_from_events,
    get_waste_summary_from_events,
)
from spectyra.monitor.cross_waste import merge_cross_event_waste_into_event
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
        prior = list(self._buffer)
        merge_cross_event_waste_into_event(prior, ev)
        self._buffer.append(ev)
        if self._jsonl:
            self._jsonl.append(ev)

    def get_events_snapshot(self) -> list[dict[str, Any]]:
        return list(self._buffer)

    def get_monitor_summary(self) -> dict[str, Any]:
        if not self._buffer:
            return empty_monitor_summary()
        return build_monitor_summary_from_events(list(self._buffer))

    def get_recent_monitor_events(self, limit: int = 50) -> list[dict[str, Any]]:
        lim = max(1, min(500, limit))
        return list(self._buffer)[-lim:]

    def get_cost_summary(self) -> dict[str, Any]:
        return self.get_monitor_summary()

    def get_provider_breakdown(self) -> list[dict[str, Any]]:
        return get_provider_breakdown_from_events(self.get_events_snapshot())

    def get_model_breakdown(self) -> list[dict[str, Any]]:
        return get_model_breakdown_from_events(self.get_events_snapshot())

    def get_environment_breakdown(self) -> list[dict[str, Any]]:
        return get_environment_breakdown_from_events(self.get_events_snapshot())

    def get_endpoint_breakdown(self) -> list[dict[str, Any]]:
        return get_endpoint_breakdown_from_events(self.get_events_snapshot())

    def get_expensive_calls(self) -> list[dict[str, Any]]:
        return get_expensive_calls_from_events(self.get_events_snapshot())

    def get_missed_savings_summary(self) -> dict[str, Any]:
        return get_missed_savings_summary_from_events(self.get_events_snapshot())

    def get_waste_summary(self) -> dict[str, Any]:
        return get_waste_summary_from_events(self.get_events_snapshot())

    def get_repeated_calls(self) -> list[dict[str, Any]]:
        return get_repeated_calls_from_events(self.get_events_snapshot())

    def get_cache_opportunities(self) -> list[dict[str, Any]]:
        return get_cache_opportunities_from_events(self.get_events_snapshot())

    def get_optimizer_quota_summary(self, quota: dict[str, Any] | None = None) -> dict[str, Any]:
        return get_optimizer_quota_summary_from_events(self.get_events_snapshot(), quota)

    def aggregate_all_views(self) -> dict[str, Any]:
        return aggregate_all_monitor_views(self.get_events_snapshot())
