# Spectyra — Java client (local runtime)

**Status:** HTTP client for the local sidecar (planned) — not yet published to Maven.

## Integration

1. Run the **Spectyra local runtime** on `http://127.0.0.1:4269` (see `runtime/local-runtime/README.md` and `runtime/contracts/openapi/spectyra-runtime.yaml`).
2. Use any HTTP client (OkHttp, Spring `WebClient`, etc.) to call:
   - `POST /v1/chat/run` — request body includes `provider`, `model`, and `messages` (stays on localhost).
3. **Never** point this client at a remote host for prompt bodies; the design is **loopback only** unless you operate your own BFF on a private network.

## Alternative today

Call an internal **Node** service in your org that uses `@spectyra/sdk` and exposes a JSON API your Java services trust.

## Privacy

See [../../docs/privacy/byok-and-local-architecture.md](../../docs/privacy/byok-and-local-architecture.md).
