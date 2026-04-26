from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, List, Optional

from spectyra.config import SpectyraConfig
from spectyra.embedded import SpectyraNative
from spectyra.result import SpectyraRunResult


class Spectyra:
    """Spectyra Python entrypoint — runtime HTTP or embedded FFI + your provider."""

    def __init__(self, config: Optional[SpectyraConfig] = None) -> None:
        self.config = config or SpectyraConfig()
        self._native: SpectyraNative | None = None
        if self.config.mode == "embedded":
            self._native = SpectyraNative(self.config.ffi_path)

    def _runtime_url(self) -> str:
        return (
            self.config.runtime_base_url
            or os.environ.get("SPECTYRA_RUNTIME_URL")
            or "http://127.0.0.1:4269"
        ).rstrip("/")

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

        return SpectyraRunResult(
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
        return SpectyraRunResult(
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
