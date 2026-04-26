from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class SpectyraRunResult:
    """Normalized result across embedded + runtime modes."""

    output: Any
    provider: str
    model: str
    savings_amount: float
    savings_percent: float
    cost_before: float
    cost_after: float
    optimization_active: bool
    warnings: List[str]
    quota_status: Optional[Dict[str, Any]] = None
    raw_envelope: Optional[Dict[str, Any]] = None
