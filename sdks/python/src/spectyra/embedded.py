from __future__ import annotations

import json
import os
from ctypes import CDLL, c_char_p, create_string_buffer
from typing import Any, Dict, Optional


class SpectyraNative:
    """Optional ctypes binding to `spectyra_ffi` (build from `runtime/spectyra_ffi`)."""

    def __init__(self, lib_path: Optional[str] = None) -> None:
        path = lib_path or os.environ.get("SPECTYRA_FFI_PATH")
        if not path:
            raise OSError("SPECTYRA_FFI_PATH is not set and no ffi_path was provided")
        self._lib = CDLL(path)
        self._lib.spectyra_free_string.argtypes = [c_char_p]
        self._lib.spectyra_free_string.restype = None
        self._lib.spectyra_run_chat_pipeline_json.argtypes = [c_char_p]
        self._lib.spectyra_run_chat_pipeline_json.restype = c_char_p
        self._lib.spectyra_calculate_savings_json.argtypes = [c_char_p]
        self._lib.spectyra_calculate_savings_json.restype = c_char_p

    def run_chat_pipeline_json(self, body: Dict[str, Any]) -> Dict[str, Any]:
        inp = json.dumps(body).encode("utf-8")
        buf = create_string_buffer(inp)
        ptr = self._lib.spectyra_run_chat_pipeline_json(buf)
        if not ptr:
            raise RuntimeError("spectyra_run_chat_pipeline_json returned null")
        try:
            raw = ptr.value.decode("utf-8")
        finally:
            self._lib.spectyra_free_string(ptr)
        return json.loads(raw)

    def calculate_savings_json(self, body: Dict[str, Any]) -> Dict[str, Any]:
        inp = json.dumps(body).encode("utf-8")
        buf = create_string_buffer(inp)
        ptr = self._lib.spectyra_calculate_savings_json(buf)
        if not ptr:
            raise RuntimeError("spectyra_calculate_savings_json returned null")
        try:
            raw = ptr.value.decode("utf-8")
        finally:
            self._lib.spectyra_free_string(ptr)
        return json.loads(raw)
