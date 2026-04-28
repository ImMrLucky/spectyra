# Spectyra SDK integration modes

Spectyra supports **multiple integration surfaces**. Pick one primary path per deployment.

**Ordered delivery:** [PHASED_CHECKLIST.md](./PHASED_CHECKLIST.md) · **Granular matrix:** [SPEC_CHECKLIST.md](./SPEC_CHECKLIST.md)

## 1. Node / TypeScript — `@spectyra/sdk` (primary in-app product)

Install into your application. Wraps provider clients locally; prompts and API keys stay on your infrastructure.

- **Docs & checklist:** [SPEC_CHECKLIST.md](./SPEC_CHECKLIST.md)
- **Package:** `packages/sdk` (published as `@spectyra/sdk`)

**Modes**

- **Cloud control plane (recommended):** Spectyra API key + optional `spectyraApiBaseUrl`. Entitlements and pricing snapshots refresh at runtime (upgrade billing without redeploying app code).
- **License / local-only paths:** Legacy OpenClaw / desktop flows may still use license keys; do not conflate with multi-language runtimes below.

## 2. Language SDKs (Python, Java, .NET, Go)

Install **from each ecosystem’s registry** — you do **not** need to clone the Spectyra repo for a normal integration.

| Language | Install | Package / coordinates |
|----------|---------|------------------------|
| **Python** | `pip install spectyra` | PyPI: `spectyra` |
| **Java** | Add Maven / Gradle dependency | `ai.spectyra:spectyra-sdk` (see `sdks/java/README.md` for XML) |
| **.NET** | `dotnet add package Spectyra.SDK` | NuGet: `Spectyra.SDK` |
| **Go** | `go get github.com/spectyra/spectyra-go@v0.1.0` | Module: `github.com/spectyra/spectyra-go` (import `…/spectyra`) |

Source for **maintainers** lives under `sdks/<language>/`. **Contributors** who change an SDK clone the repo and follow the **Contributing** section in each SDK README.

Each SDK supports:

| Mode | When to use |
|------|-------------|
| **Runtime (HTTP)** | Call a running **Spectyra local runtime** (`runtime/local-runtime`, default e.g. `http://127.0.0.1:4269`). Best when you want engine updates without shipping new native binaries, or when FFI is impractical. |
| **Embedded (native)** | Load `libspectyra_ffi` / `spectyra_ffi.dll` built from `runtime/spectyra-ffi`. Use for savings math and (where exposed) pipeline JSON helpers with **no separate process**. Requires shipping the native library per OS/arch. |

**Privacy rule (all modes):** Spectyra cloud receives only account metadata, aggregates, quota, and pricing snapshot metadata — never prompts, completions, or provider secrets. See [../privacy/byok-and-local-architecture.md](../privacy/byok-and-local-architecture.md).

**Publishing:** [PUBLISHING.md](./PUBLISHING.md)

## 3. OpenClaw (unchanged product line)

OpenClaw continues to use **`@spectyra/local-companion`**, **`@spectyra/openclaw-bridge`**, and **`@spectyra/openclaw-skill`**. That flow is separate from `sdks/*` and is not replaced by this directory.

## Building the native FFI library

Step-by-step (workspace layout, env vars, per-OS artifacts): [RUST_AND_FFI_BUILD.md](./RUST_AND_FFI_BUILD.md).

From `runtime/`:

```bash
cargo build -p spectyra_ffi --release
```

Artifacts (platform-dependent) land under `target/release/` (`libspectyra_ffi.so`, `libspectyra_ffi.dylib`, or `spectyra_ffi.dll`). Point `SPECTYRA_FFI_PATH` / language-specific env vars at this library for embedded mode (see each SDK README). The repo root script `./scripts/build-spectyra-ffi.sh` runs the same `cargo` build from `runtime/`.

## OpenAPI

Local runtime HTTP contract: `runtime/contracts/openapi/spectyra-runtime.openapi.yaml` (`/v1/chat/run`, `/v1/health`, …).
