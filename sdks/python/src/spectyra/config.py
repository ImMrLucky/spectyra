from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

IntegrationMode = Literal["runtime", "embedded"]


@dataclass
class SpectyraConfig:
    """SDK configuration."""

    mode: IntegrationMode = "runtime"
    """`runtime`: HTTP to Spectyra local runtime. `embedded`: native `spectyra_ffi` + your provider calls."""

    runtime_base_url: Optional[str] = None
    """Base URL for local runtime, e.g. `http://127.0.0.1:4269`. Default: `SPECTYRA_RUNTIME_URL` env or localhost."""

    ffi_path: Optional[str] = None
    """Path to `libspectyra_ffi` shared library. Default: `SPECTYRA_FFI_PATH` env."""

    spectyra_api_key: Optional[str] = None
    """Optional Spectyra control-plane key (never sent with prompts to cloud from this scaffold)."""
