from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any


class MonitorJsonlWriter:
    """Append-only JSONL; fail-open (swallows I/O errors)."""

    def __init__(self, path: str | Path | None, *, rotate_daily: bool = False) -> None:
        self._path = Path(path) if path else None
        self._rotate_daily = rotate_daily
        self._lock = threading.Lock()

    def append(self, row: dict[str, Any]) -> None:
        if not self._path:
            return
        line = json.dumps(row, separators=(",", ":"), default=str) + "\n"
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            with self._lock:
                with self._path.open("a", encoding="utf-8") as f:
                    f.write(line)
        except OSError:
            return
