"""Resolved options for ``spectyra_auto``."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class ResolvedAutoConfig:
    project: str | None
    environment: str | None
    service: str | None
    jsonl_path: str | None
    jsonl_enabled: bool
    console_enabled: bool


def resolve_auto_config(
    *,
    project: str | None = None,
    environment: str | None = None,
    service: str | None = None,
    jsonl_path: str | None = None,
    jsonl_enabled: bool | None = None,
    console_enabled: bool | None = None,
) -> ResolvedAutoConfig:
    je = jsonl_enabled if jsonl_enabled is not None else os.environ.get("SPECTYRA_JSONL", "").lower() != "false"
    ce = (
        console_enabled
        if console_enabled is not None
        else (
            os.environ.get("SPECTYRA_CONSOLE", "").lower() == "true"
            or (
                os.environ.get("SPECTYRA_CONSOLE", "").lower() != "false"
                and os.environ.get("ENVIRONMENT", os.environ.get("NODE_ENV", "development")).lower()
                not in ("production", "prod")
            )
        )
    )
    return ResolvedAutoConfig(
        project=project or os.environ.get("SPECTYRA_PROJECT"),
        environment=environment or os.environ.get("SPECTYRA_ENV") or os.environ.get("ENVIRONMENT"),
        service=service or os.environ.get("SPECTYRA_SERVICE"),
        jsonl_path=jsonl_path or os.environ.get("SPECTYRA_JSONL_PATH"),
        jsonl_enabled=je,
        console_enabled=bool(ce),
    )
