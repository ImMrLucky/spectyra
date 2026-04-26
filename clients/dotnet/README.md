# Spectyra — .NET client (local runtime)

**Status:** HTTP client for the local sidecar (planned) — not yet published to NuGet.

## Integration

1. Start the local runtime on `http://127.0.0.1:4269` (see `runtime/local-runtime/README.md`).
2. Use `HttpClient` to call `POST /v1/chat/run` per [OpenAPI](../../runtime/contracts/openapi/spectyra-runtime.yaml).
3. Keep provider API keys in **.NET user secrets** or environment variables on the same machine; the runtime reads them from the process environment (BYOK), not from Spectyra cloud.

## Alternative today

Host a small **Node** API using `@spectyra/sdk` and call it from C# / F# over your internal network.

## Privacy

See [../../docs/privacy/byok-and-local-architecture.md](../../docs/privacy/byok-and-local-architecture.md).
