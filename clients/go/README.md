# Spectyra — Go client (local runtime)

**Status:** Use `net/http` against the local sidecar (planned) — no official Go module yet.

## Integration

1. Run the Spectyra local runtime on `127.0.0.1:4269`.
2. `POST http://127.0.0.1:4269/v1/chat/run` with JSON `provider`, `model`, `messages` as defined in [spectyra-runtime.yaml](../../runtime/contracts/openapi/spectyra-runtime.yaml).
3. For production before the sidecar ships, place a **Node** BFF using `@spectyra/sdk` in front of your Go services.

## Privacy

Provider keys and message bodies must never be sent to Spectyra. See [../../docs/privacy/byok-and-local-architecture.md](../../docs/privacy/byok-and-local-architecture.md).
