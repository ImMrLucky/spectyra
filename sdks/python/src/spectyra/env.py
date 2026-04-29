"""Environment / overlay / debug resolution (parity with `@spectyra/sdk` gates)."""

from __future__ import annotations

import os
from typing import Optional


def is_production_environment(environment: Optional[str]) -> bool:
    if environment is not None and str(environment).strip() != "":
        e = str(environment).strip().lower()
        if e in ("production", "prod"):
            return True
        if e in ("development", "dev", "qa", "staging", "test"):
            return False
    return os.environ.get("NODE_ENV", "").lower() == "production"


def resolve_effective_overlay(environment: Optional[str], overlay: Optional[bool]) -> bool:
    if overlay is False:
        return False
    if overlay is True:
        return True
    if os.environ.get("SPECTYRA_OVERLAY", "").lower() == "true":
        return not is_production_environment(environment)
    return False


def resolve_effective_debug(environment: Optional[str], debug: Optional[bool]) -> bool:
    if debug is False:
        return False
    if debug is True:
        return True
    if os.environ.get("SPECTYRA_DEBUG", "").lower() == "true":
        return not is_production_environment(environment)
    return False


def resolve_environment_label(environment: Optional[str]) -> str:
    if environment is not None and str(environment).strip() != "":
        return str(environment).strip()
    v = os.environ.get("APP_ENV") or os.environ.get("NODE_ENV")
    return v if v else "runtime"
