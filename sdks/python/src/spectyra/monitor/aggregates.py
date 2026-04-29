"""Monitor rollups and breakdowns (in-memory events), parity with TS monitorAggregates."""

from __future__ import annotations

from typing import Any

from spectyra.monitor.summaries import build_monitor_summary_from_events


def _spend(ev: dict[str, Any]) -> float:
    return float(ev.get("actualCostUsd") or ev.get("estimatedCostUsd") or 0.0)


def _tokens(ev: dict[str, Any]) -> int:
    return int(ev.get("totalTokens") or (int(ev.get("inputTokens") or 0) + int(ev.get("outputTokens") or 0)))


def _collect_waste(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for e in events:
        for w in e.get("wasteSignals") or []:
            if isinstance(w, dict):
                out.append(w)
    return out[:20]


def _row_from_group(key: str, evs: list[dict[str, Any]]) -> dict[str, Any]:
    n = len(evs)
    spend_usd = opt_spend = pot = sav = miss = 0.0
    tok = lat = err = 0
    for e in evs:
        spend_usd += _spend(e)
        opt_spend += float(e.get("optimizedCostUsd") or 0.0)
        pot += float(e.get("projectedOptimizedCostUsd") or 0.0)
        sav += float(e.get("savedUsd") or 0.0)
        miss += float(e.get("missedSavingsUsd") or 0.0)
        tok += _tokens(e)
        lat += int(e.get("latencyMs") or 0)
        if not e.get("success", True):
            err += 1
    waste = _collect_waste(evs)[:5]
    return {
        "key": key,
        "requestCount": n,
        "actualSpendProviderUsd": spend_usd,
        "optimizedSpendSpectyraUsd": opt_spend if opt_spend > 0 else None,
        "potentialSpendWithSpectyraUsd": pot if pot > 0 else None,
        "savingsUsd": sav,
        "missedSavingsUsd": miss,
        "totalTokens": tok,
        "averageCostUsd": (spend_usd / n) if n else 0.0,
        "averageLatencyMs": (lat / n) if n else 0.0,
        "errorRate": (err / n) if n else 0.0,
        "topWasteSignals": waste,
    }


def _group(events: list[dict[str, Any]], key_fn: Any) -> dict[str, list[dict[str, Any]]]:
    m: dict[str, list[dict[str, Any]]] = {}
    for e in events:
        k = key_fn(e) or "unknown"
        m.setdefault(k, []).append(e)
    return m


def get_provider_breakdown_from_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    m = _group(events, lambda e: str(e.get("provider") or "unknown"))
    rows = [_row_from_group(k, evs) for k, evs in m.items()]
    return sorted(rows, key=lambda r: r["actualSpendProviderUsd"], reverse=True)


def get_model_breakdown_from_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    m = _group(events, lambda e: f'{e.get("provider")}:{e.get("model") or "unknown"}')
    rows = [_row_from_group(k, evs) for k, evs in m.items()]
    return sorted(rows, key=lambda r: r["actualSpendProviderUsd"], reverse=True)


def get_environment_breakdown_from_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    m = _group(events, lambda e: str(e.get("environment") or "unknown"))
    rows = [_row_from_group(k, evs) for k, evs in m.items()]
    return sorted(rows, key=lambda r: r["requestCount"], reverse=True)


def get_endpoint_breakdown_from_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def key_fn(e: dict[str, Any]) -> str:
        return str(e.get("endpoint") or e.get("route") or e.get("urlHost") or "unknown")

    m = _group(events, key_fn)
    rows = [_row_from_group(k, evs) for k, evs in m.items()]
    return sorted(rows, key=lambda r: r["actualSpendProviderUsd"], reverse=True)


def get_expensive_calls_from_events(events: list[dict[str, Any]], limit: int = 15) -> list[dict[str, Any]]:
    return sorted(events, key=_spend, reverse=True)[:limit]


def get_missed_savings_summary_from_events(events: list[dict[str, Any]]) -> dict[str, Any]:
    t = 0.0
    n = 0
    for e in events:
        m = float(e.get("missedSavingsUsd") or 0.0)
        if m > 0:
            t += m
            n += 1
    return {
        "totalMissedSavingsUsd": t,
        "eventCount": n,
        "averageMissedPerEventUsd": (t / n) if n else 0.0,
    }


def get_waste_summary_from_events(events: list[dict[str, Any]]) -> dict[str, Any]:
    by_type: dict[str, int] = {}
    impact = 0.0
    for e in events:
        for w in e.get("wasteSignals") or []:
            if not isinstance(w, dict):
                continue
            t = str(w.get("type") or "unknown")
            by_type[t] = by_type.get(t, 0) + 1
            impact += float(w.get("estimatedWasteUsd") or 0.0)
    return {"byType": by_type, "estimatedImpactUsd": impact}


def get_events_with_waste_type(events: list[dict[str, Any]], wtype: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for e in events:
        for w in e.get("wasteSignals") or []:
            if isinstance(w, dict) and w.get("type") == wtype:
                out.append(e)
                break
    return out


def get_repeated_calls_from_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return get_events_with_waste_type(events, "repeated_call")


def get_cache_opportunities_from_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return get_events_with_waste_type(events, "cache_opportunity")


def get_optimizer_quota_summary_from_events(
    events: list[dict[str, Any]],
    quota: dict[str, Any] | None,
) -> dict[str, Any]:
    q = quota or {}
    lim = 0
    for e in events:
        st = e.get("optimizerStatus")
        if st and st != "enabled":
            lim += 1
    return {
        "plan": str(q.get("plan") or "unknown"),
        "canRunOptimized": q.get("canRunOptimized") is not False,
        "freeOptimizerPercentUsed": q.get("percentUsed"),
        "monitorEventsWhileLimited": lim,
    }


def aggregate_all_monitor_views(events: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "summary": build_monitor_summary_from_events(events),
        "provider": get_provider_breakdown_from_events(events),
        "model": get_model_breakdown_from_events(events),
        "environment": get_environment_breakdown_from_events(events),
        "endpoint": get_endpoint_breakdown_from_events(events),
        "expensive": get_expensive_calls_from_events(events),
        "missed": get_missed_savings_summary_from_events(events),
        "waste": get_waste_summary_from_events(events),
        "repeated": get_repeated_calls_from_events(events),
        "cache": get_cache_opportunities_from_events(events),
    }
