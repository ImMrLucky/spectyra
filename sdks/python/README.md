# Spectyra Python SDK (`spectyra`)

Call a **Spectyra local runtime** over HTTP, or (advanced) load the native **FFI** library and run optimization in-process. Prompts and **provider API keys stay on your machines** — Spectyra cloud only sees account metadata, aggregates, and pricing signals you opt into, not your prompts or secrets.

---

## Install

```bash
pip install spectyra
```

Requires **Python 3.10+**. No Git clone is required for normal use.

---

## BYOK and local-first

- **Runtime mode:** Your app sends `provider`, `model`, and `messages` to a **Spectyra local runtime** you run (default base URL `http://127.0.0.1:4269`). **OpenAI / Anthropic / Groq keys are configured on that runtime**, not shipped to Spectyra’s cloud.
- **Embedded mode:** You load `libspectyra_ffi` and call the pipeline locally; **your code** calls the provider with **your** keys after optimization.
- **Cloud:** Optional Spectyra API key is for **entitlements / billing / telemetry aggregates** — not for proxying inference with your provider secret.

---

## Hello world (runtime)

Start your **Spectyra local runtime** first (see repo `runtime/local-runtime` or your operator docs). Then:

```python
from spectyra import Spectyra, SpectyraConfig

spectyra = Spectyra(SpectyraConfig(mode="runtime", runtime_base_url="http://127.0.0.1:4269"))

result = spectyra.run_chat_runtime(
    provider="openai",
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}],
)

print(result.optimization_active, result.savings_percent, result.output)
```

`result.output` is whatever the runtime returns in its JSON envelope (shape depends on runtime version).

---

## Runtime mode (reference)

Same as hello world: `SpectyraConfig(mode="runtime", ...)` and `run_chat_runtime(...)`. Optional `request_id` and `metadata` map are forwarded to `POST /v1/chat/run`.

```python
result = spectyra.run_chat_runtime(
    provider="openai",
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Summarize: …"}],
    request_id="req-123",
    metadata={"environment": "staging"},
)
```

OpenAPI for the runtime: `runtime/contracts/openapi/spectyra-runtime.openapi.yaml` in the Spectyra repo.

---

## AI cost monitor (Python Phases 3–4)

**Monitor core** (`spectyra.monitor.MonitorEngine`): in-memory buffer, optional JSONL, metadata-only rows (parity with `@spectyra/sdk` monitor).

**Auto hook** (`start_spectyra_auto` / `stop_spectyra_auto`): patches `urllib.request.urlopen` for known LLM JSON responses. See `docs/SPECTYRA_PYTHON_MONITORING.md`.

---

## Embedded mode (optional)

Build `libspectyra_ffi` per [RUST_AND_FFI_BUILD.md](https://github.com/spectyra/spectyra/blob/main/docs/sdk/RUST_AND_FFI_BUILD.md), then:

```python
from spectyra import Spectyra, SpectyraConfig

spectyra = Spectyra(
    SpectyraConfig(
        mode="embedded",
        ffi_path="/path/to/libspectyra_ffi.dylib",
    )
)

def call_openai(messages):
    # use openai-python with OPENAI_API_KEY in your environment
    ...

result = spectyra.run_chat(
    provider="openai",
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello"}],
    entitlement={"plan": "trial"},
    call_provider=call_openai,
)
```

---

## Contributing

**Clone this repository only if you are developing or changing the Spectyra SDK itself** (or running the conformance suite).

```bash
git clone https://github.com/spectyra/spectyra.git
cd spectyra/sdks/python
pip install -e ".[dev]"
PYTHONPATH=src python3 -m unittest discover -s tests -p 'test_*.py' -q
```

Normal integrations should use **`pip install spectyra`** from PyPI.

---

## More documentation

- Integration modes (all languages): [docs/sdk/README.md](https://github.com/spectyra/spectyra/blob/main/docs/sdk/README.md)
