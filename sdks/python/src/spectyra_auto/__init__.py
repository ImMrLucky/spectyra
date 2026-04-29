"""
One-import auto monitoring for Python (``import spectyra_auto``).

Disabled when ``SPECTYRA_AUTO=false``. Use :func:`start` / :func:`stop` for explicit control.
"""

from __future__ import annotations

import os

from spectyra_auto.state import get_engine, start, stop

__all__ = ["start", "stop", "get_engine"]

if os.environ.get("SPECTYRA_AUTO", "").strip().lower() != "false":
    try:
        start()
    except Exception:
        pass
