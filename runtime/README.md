# Spectyra Rust runtime workspace

Cargo workspace:

- **`core-rust/`** — library crate `spectyra_core`: pricing, session metrics + quota freeze, privacy-safe telemetry DTOs, optimization pipeline skeleton.
- **`local-runtime/`** — binary `spectyra-runtime`: Axum server on **`127.0.0.1:4269`** with provider adapters (OpenAI, Anthropic, Google Gemini).

Build:

```bash
cd runtime
cargo build --release -p spectyra_local_runtime
```

Documentation:

- Integration guide: `docs/runtime/README.md`
- Privacy / BYOK: `docs/privacy/byok-and-local-architecture.md`
- HTTP contract: `contracts/openapi/spectyra-runtime.openapi.yaml`

Docker build (from repo root):

```bash
docker build -f runtime/Dockerfile -t spectyra/local-runtime runtime
```
