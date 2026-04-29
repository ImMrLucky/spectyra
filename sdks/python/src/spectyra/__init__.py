"""Spectyra Python SDK — runtime HTTP + optional native FFI."""

from spectyra.client import Spectyra
from spectyra.config import SpectyraConfig
from spectyra.result import SpectyraRunResult
from spectyra.monitor.engine import MonitorEngine
from spectyra.automation import get_auto_monitor_engine, start_spectyra_auto, stop_spectyra_auto

__all__ = [
    "Spectyra",
    "SpectyraConfig",
    "SpectyraRunResult",
    "MonitorEngine",
    "start_spectyra_auto",
    "stop_spectyra_auto",
    "get_auto_monitor_engine",
]
