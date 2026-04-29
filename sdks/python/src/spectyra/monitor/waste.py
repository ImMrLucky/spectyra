from __future__ import annotations

from typing import Any


def build_waste_signals_http_auto(
    *,
    input_tokens: int,
    output_tokens: int,
    latency_ms: int,
    actual_cost_usd: float = 0.0,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if input_tokens > 80_000:
        out.append(
            {
                "type": "large_context",
                "severity": "warning",
                "title": "Large prompt tokens",
                "description": "Provider usage shows a very large input token count.",
                "confidence": "high",
            }
        )
    if output_tokens > 12_000 or (input_tokens > 500 and output_tokens > input_tokens * 3):
        out.append(
            {
                "type": "high_output_tokens",
                "severity": "info",
                "title": "High completion tokens",
                "description": "Output token volume is high.",
                "confidence": "medium",
            }
        )
    if latency_ms > 50_000 and actual_cost_usd > 0.1:
        out.append(
            {
                "type": "slow_expensive_call",
                "severity": "info",
                "title": "Slow provider response",
                "description": "This LLM HTTP call took a long time with noticeable cost.",
                "confidence": "low",
            }
        )
    return out
