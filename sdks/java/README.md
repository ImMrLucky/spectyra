# Spectyra Java SDK (`ai.spectyra:spectyra-sdk`)

Scaffold for JVM backends. See [../../docs/sdk/README.md](../../docs/sdk/README.md).

## Build

```bash
cd sdks/java && mvn -q test
```

## Runtime mode (default)

`Spectyra.runChatRuntime` posts to `SPECTYRA_RUNTIME_URL` + `/v1/chat/run`. Configure provider API keys on the **Spectyra local runtime** process.

## Embedded mode (future)

JNI/JNA against `libspectyra_ffi` — tracked in `docs/sdk/SPEC_CHECKLIST.md`.
