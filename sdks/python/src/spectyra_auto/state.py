"""Singleton auto-monitor: ``requests`` + ``httpx`` patches + :class:`~spectyra.monitor.engine.MonitorEngine`."""

from __future__ import annotations

import threading
from typing import Any, Callable

from spectyra.monitor.engine import MonitorEngine
from spectyra_auto.config import resolve_auto_config
from spectyra_auto.patch_httpx import install as install_httpx
from spectyra_auto.patch_aiohttp import install as install_aiohttp
from spectyra_auto.patch_optional import (
    install_anthropic_sdk,
    install_langchain,
    install_llamaindex,
    install_openai_sdk,
)
from spectyra_auto.patch_requests import install as install_requests

_engine: MonitorEngine | None = None
_uninstall: list[Callable[[], None]] = []
_lock = threading.Lock()


def get_engine() -> MonitorEngine | None:
    return _engine


def start(
    *,
    project: str | None = None,
    environment: str | None = None,
    service: str | None = None,
    jsonl_path: str | None = None,
    cloud_sync: bool = False,
    dev_bridge: bool = False,
    jsonl_enabled: bool | None = None,
    console_enabled: bool | None = None,
) -> MonitorEngine:
    """
    Idempotent: install HTTP client patches and return the shared :class:`~spectyra.monitor.engine.MonitorEngine`.

    ``cloud_sync`` / ``dev_bridge`` are accepted for API parity; cloud sync is not wired in Python yet.
    """
    del cloud_sync, dev_bridge
    global _engine, _uninstall
    with _lock:
        if _engine is not None:
            return _engine
        cfg = resolve_auto_config(
            project=project,
            environment=environment,
            service=service,
            jsonl_path=jsonl_path,
            jsonl_enabled=jsonl_enabled,
            console_enabled=console_enabled,
        )
        _engine = MonitorEngine(
            enabled=True,
            jsonl_path=cfg.jsonl_path,
            jsonl_enabled=cfg.jsonl_enabled,
            defaults={
                "project": cfg.project,
                "environment": cfg.environment,
                "service": cfg.service,
                "integrationMode": "auto_provider_sdk",
            },
        )
        labels = {"project": cfg.project, "environment": cfg.environment, "service": cfg.service}
        _uninstall = [
            install_requests(get_engine, labels),
            install_httpx(get_engine, labels),
            install_aiohttp(get_engine, labels),
            install_openai_sdk(get_engine, labels),
            install_anthropic_sdk(get_engine, labels),
            install_langchain(get_engine, labels),
            install_llamaindex(get_engine, labels),
        ]
        return _engine


def stop() -> None:
    global _engine, _uninstall
    with _lock:
        for fn in _uninstall:
            try:
                fn()
            except Exception:
                pass
        _uninstall = []
        _engine = None
