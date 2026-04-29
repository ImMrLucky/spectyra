from __future__ import annotations

import copy
from typing import Any

_FORBIDDEN = frozenset(
    k.lower()
    for k in (
        "authorization",
        "apikey",
        "api_key",
        "x-api-key",
        "openai_api_key",
        "anthropic_api_key",
        "prompt",
        "messages",
        "response",
        "content",
        "body",
        "rawbody",
        "input_text",
        "output_text",
    )
)


def scrub_monitor_event_for_persistence(ev: dict[str, Any]) -> dict[str, Any]:
    out = {k: copy.deepcopy(v) for k, v in ev.items() if k.lower() not in _FORBIDDEN}
    out["metadataOnly"] = True
    return out
