from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Optional

from spectyra.config import SpectyraConfig
from spectyra.embedded import SpectyraNative
from spectyra.env import resolve_effective_debug, resolve_effective_overlay, resolve_environment_label
from spectyra.result import SpectyraRunResult

if TYPE_CHECKING:
    from spectyra.monitor.engine import MonitorEngine


class Spectyra:
    """Spectyra Python entrypoint — runtime HTTP or embedded FFI + your provider."""

    def __init__(self, config: Optional[SpectyraConfig] = None) -> None:
        self.config = config or SpectyraConfig()
        self._native: SpectyraNative | None = None
        self._last_result: Optional[SpectyraRunResult] = None
        self._savings_listeners: List[Callable[[Dict[str, Any]], None]] = []
        self._overlay_notice_shown = False
        self._monitor_engine: Optional["MonitorEngine"] = None
        if self.config.mode == "embedded":
            self._native = SpectyraNative(self.config.ffi_path)

    def _runtime_url(self) -> str:
        return (
            self.config.runtime_base_url
            or os.environ.get("SPECTYRA_RUNTIME_URL")
            or "http://127.0.0.1:4269"
        ).rstrip("/")

    def _finalize_run(self, result: SpectyraRunResult) -> SpectyraRunResult:
        self._last_result = result
        env_label = self.config.environment
        if resolve_effective_debug(env_label, self.config.debug):
            self._debug_log_result(result)
        ev = self._savings_event_dict(result)
        for fn in list(self._savings_listeners):
            try:
                fn(ev)
            except Exception as e:  # noqa: BLE001
                print(f"[Spectyra] savings listener error: {e!s}", file=sys.stderr)
        return result

    def _savings_event_dict(self, result: SpectyraRunResult) -> Dict[str, Any]:
        rid = None
        if isinstance(result.raw_envelope, dict):
            rid = result.raw_envelope.get("requestId")
        return {
            "run_id": rid,
            "trace_id": rid,
            "provider": result.provider,
            "model": result.model,
            "optimized": bool(result.optimization_active),
            "passthrough_reason": None if result.optimization_active else "optimization_inactive_or_quota",
            "savings_percent": result.savings_percent,
            "savings_usd": result.savings_amount,
            "cost_before": result.cost_before,
            "cost_after": result.cost_after,
            "environment": resolve_environment_label(self.config.environment),
        }

    def _debug_log_result(self, result: SpectyraRunResult) -> None:
        if result.optimization_active and result.savings_percent > 0:
            msg = (
                f"[Spectyra] optimized request: saved {result.savings_percent:.0f}%, "
                f"estimated ${result.savings_amount:.2f}"
            )
        else:
            msg = "[Spectyra] passthrough: optimization_inactive_or_quota"
        print(msg, file=sys.stderr)

    def run_chat_runtime(
        self,
        *,
        provider: str,
        model: str,
        messages: List[Dict[str, str]],
        request_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SpectyraRunResult:
        """Call the Spectyra local runtime `POST /v1/chat/run` (provider keys live on the runtime)."""
        url = f"{self._runtime_url()}/v1/chat/run"
        body: Dict[str, Any] = {"provider": provider, "model": model, "messages": messages}
        if request_id:
            body["requestId"] = request_id
        if metadata is not None:
            body["metadata"] = metadata
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=600) as resp:
                env = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise RuntimeError(e.read().decode("utf-8", errors="replace")) from e

        result = SpectyraRunResult(
            output=env.get("output"),
            provider=str(env.get("provider", provider)),
            model=str(env.get("model", model)),
            savings_amount=float(env.get("savingsAmount", 0) or 0),
            savings_percent=float(env.get("savingsPercent", 0) or 0),
            cost_before=float(env.get("costBefore", 0) or 0),
            cost_after=float(env.get("costAfter", 0) or 0),
            optimization_active=bool(env.get("optimizationActive", False)),
            warnings=list(env.get("warnings") or []),
            quota_status=env.get("quotaStatus"),
            raw_envelope=env,
        )
        return self._finalize_run(result)

    def run_chat(
        self,
        *,
        provider: str,
        model: str,
        messages: List[Dict[str, str]],
        entitlement: Optional[Dict[str, Any]] = None,
        call_provider: Optional[Callable[[List[Dict[str, str]]], Any]] = None,
        session_frozen: bool = False,
        request_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SpectyraRunResult:
        """
        If `config.mode` is `runtime`, delegates to `run_chat_runtime`.

        If `embedded`, runs `spectyra_run_chat_pipeline_json` then `call_provider(optimized_messages)`.
        Wire cost/savings yourself via `SpectyraNative.calculate_savings_json` when you have usage pairs.
        """
        if self.config.mode == "runtime":
            return self.run_chat_runtime(
                provider=provider,
                model=model,
                messages=messages,
                request_id=request_id,
                metadata=metadata,
            )
        if not self._native or not entitlement or not call_provider:
            raise RuntimeError("embedded mode requires ffi_path, entitlement dict, and call_provider")
        pipe = self._native.run_chat_pipeline_json(
            {
                "request": {"provider": provider, "model": model, "messages": messages},
                "entitlement": entitlement,
                "sessionFrozen": session_frozen,
            }
        )
        if not pipe.get("ok"):
            raise RuntimeError(pipe.get("error", "pipeline error"))
        optimized = pipe["output"]["request"]["messages"]
        out = call_provider(optimized)
        result = SpectyraRunResult(
            output=out,
            provider=provider,
            model=model,
            savings_amount=0.0,
            savings_percent=0.0,
            cost_before=0.0,
            cost_after=0.0,
            optimization_active=bool(pipe["output"].get("optimizationApplied")),
            warnings=list(pipe["output"].get("warnings") or []),
            raw_envelope=pipe,
        )
        return self._finalize_run(result)

    def attach_monitor_engine(self, engine: Optional["MonitorEngine"]) -> None:
        """Attach a :class:`~spectyra.monitor.engine.MonitorEngine` for dev bridge / dashboards (optional)."""
        self._monitor_engine = engine

    @property
    def monitor(self) -> Optional["MonitorEngine"]:
        """Active monitor engine: explicitly attached, else auto global if :func:`spectyra_auto.start` ran."""
        if self._monitor_engine is not None:
            return self._monitor_engine
        from spectyra.automation import get_auto_monitor_engine

        return get_auto_monitor_engine()

    def get_savings(self) -> Dict[str, Any]:
        """Safe snapshot of the last runtime result (no prompt bodies)."""
        r = self._last_result
        if not r:
            return {"last_run": None}
        return {
            "last_run": {
                "provider": r.provider,
                "model": r.model,
                "savings_percent": r.savings_percent,
                "savings_amount": r.savings_amount,
                "cost_before": r.cost_before,
                "cost_after": r.cost_after,
                "optimization_active": r.optimization_active,
                "quota_status": r.quota_status,
            }
        }

    def on_savings(self, listener: Callable[[Dict[str, Any]], None]) -> Callable[[], None]:
        """Subscribe to post-run savings events (numeric summaries only). Returns unsubscribe callable."""

        self._savings_listeners.append(listener)

        def unsubscribe() -> None:
            try:
                self._savings_listeners.remove(listener)
            except ValueError:
                pass

        return unsubscribe

    def show_overlay(self) -> None:
        """No-op in Python: floating savings UI is implemented in `@spectyra/sdk` (browser) only."""
        if resolve_effective_overlay(self.config.environment, self.config.overlay) and not self._overlay_notice_shown:
            print(
                "[Spectyra] Savings overlay is only available in the TypeScript `@spectyra/sdk` (browser). "
                "Use `get_savings()` or `on_savings()` here.",
                file=sys.stderr,
            )
            self._overlay_notice_shown = True

    def hide_overlay(self) -> None:
        """No-op in Python (see `show_overlay`)."""

    def toggle_overlay(self) -> None:
        """No-op in Python (see `show_overlay`)."""
