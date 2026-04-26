# Local runtime (sidecar) — *in development*

`127.0.0.1:4269` HTTP API for **non-Node** stacks (Java, .NET, Go) to get the same local-first, BYOK behavior as `@spectyra/sdk`, without shipping prompts to Spectyra.

## Contract

- OpenAPI: [../contracts/openapi/spectyra-runtime.yaml](../contracts/openapi/spectyra-runtime.yaml)
- Core privacy split: [../core-rust/](../core-rust/) — `LocalOptimizationRequest` (prompts OK in-process) vs `AggregatedRunTelemetry` (cloud-safe only)

## Plan

1. Rust or native daemon binds **localhost** only.
2. Reads **provider API keys** from the host environment / OS secret store; never sends them to Spectyra.
3. Executes the optimization pipeline, then the provider call, on the same machine.
4. Emits only **aggregated** events / `POST` telemetry to the control plane (when configured), matching the Node SDK’s privacy bar.

## Install (future)

```bash
spectyra-runtime start
```

## Docker (future)

```bash
docker run -p 127.0.0.1:4269:4269 spectyra/runtime
```

Until the binary is published, use the **Node SDK** (`@spectyra/sdk`) for production paths, or a small internal Node BFF that wraps `createSpectyra()`.

## Related

- [../../docs/runtime/README.md](../../docs/runtime/README.md) — full platform story
- [../../docs/privacy/byok-and-local-architecture.md](../../docs/privacy/byok-and-local-architecture.md) — data plane vs control plane
