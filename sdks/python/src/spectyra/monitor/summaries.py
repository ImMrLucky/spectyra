from __future__ import annotations

from typing import Any


def empty_monitor_summary() -> dict[str, Any]:
    return {
        "requestCount": 0,
        "successCount": 0,
        "errorCount": 0,
        "actualSpendProviderUsd": 0.0,
        "optimizedSpendSpectyraUsd": 0.0,
        "savingsUsd": 0.0,
        "missedSavingsUsd": 0.0,
        "totalTokens": 0,
        "inputTokens": 0,
        "outputTokens": 0,
        "averageCostPerRequestUsd": 0.0,
        "averageLatencyMs": 0.0,
        "p95LatencyMs": 0.0,
        "lastRequestAt": None,
    }


def _percentile(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    idx = min(len(sorted_vals) - 1, max(0, int(p * len(sorted_vals)) - 1))
    return float(sorted_vals[idx])


def build_monitor_summary_from_events(events: list[dict[str, Any]]) -> dict[str, Any]:
    success = error = 0
    actual_spend = opt_spend = savings = missed = 0.0
    tot_tok = in_tok = out_tok = 0
    latencies: list[float] = []
    last_at: str | None = None

    for e in events:
        if e.get("success", True):
            success += 1
        else:
            error += 1
        actual = float(e.get("actualCostUsd") or e.get("estimatedCostUsd") or 0.0)
        actual_spend += actual
        opt_spend += float(e.get("optimizedCostUsd") or 0.0)
        savings += float(e.get("savedUsd") or 0.0)
        missed += float(e.get("missedSavingsUsd") or 0.0)
        tot = int(e.get("totalTokens") or (int(e.get("inputTokens") or 0) + int(e.get("outputTokens") or 0)))
        tot_tok += tot
        in_tok += int(e.get("inputTokens") or 0)
        out_tok += int(e.get("outputTokens") or 0)
        latencies.append(float(e.get("latencyMs") or 0))
        ts = e.get("timestamp")
        if isinstance(ts, str) and (last_at is None or ts > last_at):
            last_at = ts

    n = len(events)
    lat_sorted = sorted(latencies)
    return {
        "requestCount": n,
        "successCount": success,
        "errorCount": error,
        "actualSpendProviderUsd": actual_spend,
        "optimizedSpendSpectyraUsd": opt_spend,
        "savingsUsd": savings,
        "missedSavingsUsd": missed,
        "totalTokens": tot_tok,
        "inputTokens": in_tok,
        "outputTokens": out_tok,
        "averageCostPerRequestUsd": (actual_spend / n) if n else 0.0,
        "averageLatencyMs": (sum(latencies) / n) if n else 0.0,
        "p95LatencyMs": _percentile(lat_sorted, 0.95),
        "lastRequestAt": last_at,
    }
