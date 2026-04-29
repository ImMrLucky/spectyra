"""Optional LangChain callback handler (metadata-only)."""

from __future__ import annotations

import time
from typing import Any, Callable


def try_create_langchain_handler(
    record_event: Callable[[dict[str, Any]], None],
    *,
    provider: str,
    model: str | None = None,
    agent_name: str | None = None,
    endpoint: str | None = None,
    workflow_type: str | None = None,
    project: str | None = None,
    environment: str | None = None,
    service: str | None = None,
) -> Any:
    """
    Returns a ``langchain_core`` :class:`BaseCallbackHandler` instance, or ``None`` if LangChain is not installed.
    """
    try:
        from langchain_core.callbacks.base import BaseCallbackHandler
    except ImportError:
        try:
            from langchain_core.callbacks import BaseCallbackHandler
        except ImportError:
            return None

    class SpectyraLangchainHandler(BaseCallbackHandler):  # type: ignore[misc, valid-type]
        name = "spectyra_monitor"

        def __init__(self) -> None:
            super().__init__()
            self._run_starts: dict[str, float] = {}

        def on_llm_start(self, *_args: Any, **kwargs: Any) -> None:
            rid = str(kwargs.get("run_id") or "")
            if rid:
                self._run_starts[rid] = time.monotonic()

        def on_llm_end(self, response: Any, **kwargs: Any) -> None:
            rid = str(kwargs.get("run_id") or "")
            t0 = self._run_starts.pop(rid, time.monotonic())
            latency_ms = int(max(0, (time.monotonic() - t0) * 1000))
            llm_output = getattr(response, "llm_output", None) or {}
            tok: dict[str, Any] = {}
            if isinstance(llm_output, dict):
                raw = llm_output.get("token_usage") or llm_output.get("usage") or {}
                if isinstance(raw, dict):
                    tok = raw
            inp = int(tok.get("prompt_tokens") or tok.get("input_tokens") or 0)
            out = int(tok.get("completion_tokens") or tok.get("output_tokens") or 0)
            record_event(
                {
                    "provider": provider,
                    "model": model,
                    "latencyMs": latency_ms,
                    "success": True,
                    "integrationMode": "framework_hook",
                    "inputTokens": inp,
                    "outputTokens": out,
                    "totalTokens": inp + out,
                    "agentName": agent_name,
                    "endpoint": endpoint,
                    "workflowType": workflow_type,
                    "project": project,
                    "environment": environment,
                    "service": service,
                    "pricingSource": "provider_usage" if (inp or out) else "unknown",
                    "optimizerApplied": False,
                    "optimizerStatus": "not_integrated",
                }
            )

        def on_llm_error(self, *_args: Any, **kwargs: Any) -> None:
            rid = str(kwargs.get("run_id") or "")
            t0 = self._run_starts.pop(rid, time.monotonic())
            latency_ms = int(max(0, (time.monotonic() - t0) * 1000))
            record_event(
                {
                    "provider": provider,
                    "model": model,
                    "latencyMs": latency_ms,
                    "success": False,
                    "integrationMode": "framework_hook",
                    "agentName": agent_name,
                    "endpoint": endpoint,
                    "workflowType": workflow_type,
                    "project": project,
                    "environment": environment,
                    "service": service,
                    "pricingSource": "unknown",
                    "optimizerApplied": False,
                    "optimizerStatus": "not_integrated",
                }
            )

    return SpectyraLangchainHandler()
