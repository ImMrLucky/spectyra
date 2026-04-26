# Rust workspace + `spectyra_ffi` (C ABI) for multi-language SDKs

## Workspace layout

| Crate | Role |
|-------|------|
| `runtime/core-rust` (`spectyra_core`) | Algorithms, pricing, pipeline, models |
| `runtime/local-runtime` | HTTP service (`POST /v1/chat/run`, …) |
| `runtime/spectyra-ffi` (`spectyra_ffi`) | **cdylib** + **rlib** — JSON in/out for Python / Java / .NET / Go |

## Build (requires Rust toolchain)

From repo root:

```bash
cd runtime
cargo build --workspace
cargo test --workspace
```

Release **shared library** for SDKs:

```bash
cd runtime
cargo build -p spectyra_ffi --release
```

Artifacts (platform-dependent names):

- **Linux:** `runtime/target/release/libspectyra_ffi.so`
- **macOS:** `runtime/target/release/libspectyra_ffi.dylib`
- **Windows:** `runtime/target/release/spectyra_ffi.dll`

Convenience script (prints the release path after build):

```bash
./scripts/build-spectyra-ffi.sh
```

## Environment variables

| Variable | Used by |
|----------|---------|
| `SPECTYRA_FFI_PATH` | Python `ctypes`, Java JNA, .NET `NativeLibrary`, Go `dlopen` (linux/amd64 CGO) |
| `SPECTYRA_RUNTIME_URL` | All SDKs in **runtime HTTP** mode (default `http://127.0.0.1:4269`) |

## CI

`.github/workflows/runtime-rust.yml` runs `cargo build` + `cargo test` on `runtime/`.
