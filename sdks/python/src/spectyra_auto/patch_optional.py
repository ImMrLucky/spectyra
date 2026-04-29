"""Optional no-op installers for vendor SDKs (install only when dependency present)."""

from __future__ import annotations

from typing import Any, Callable


def install_openai_sdk(_get_engine: Callable[[], Any], _defaults: dict[str, Any | None]) -> Callable[[], None]:
    return lambda: None


def install_anthropic_sdk(_get_engine: Callable[[], Any], _defaults: dict[str, Any | None]) -> Callable[[], None]:
    return lambda: None


def install_langchain(_get_engine: Callable[[], Any], _defaults: dict[str, Any | None]) -> Callable[[], None]:
    return lambda: None


def install_llamaindex(_get_engine: Callable[[], Any], _defaults: dict[str, Any | None]) -> Callable[[], None]:
    return lambda: None
