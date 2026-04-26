#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/runtime"
cargo build -p spectyra_ffi --release
OUT="$ROOT/runtime/target/release"
echo "Built spectyra_ffi release artifacts under:"
ls -la "$OUT"/libspectyra_ffi.* "$OUT"/spectyra_ffi.dll 2>/dev/null || true
echo "Set SPECTYRA_FFI_PATH to the absolute path of the .so / .dylib / .dll for language SDKs."
