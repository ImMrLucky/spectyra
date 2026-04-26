# Spectyra Python SDK (`spectyra`)

Same-repo scaffold for **non-Node** backends. See [../../docs/sdk/README.md](../../docs/sdk/README.md) for integration modes.

## Modes

| Mode | Env / setup | `run_chat` behavior |
|------|-------------|---------------------|
| **Runtime** (default) | `SPECTYRA_RUNTIME_URL` (e.g. `http://127.0.0.1:4269`) | `POST /v1/chat/run` — provider API keys must be configured **on the Spectyra local runtime** (BYOK server-side). |
| **Embedded** | `SPECTYRA_FFI_PATH` → `libspectyra_ffi.so` / `.dylib` / `.dll` from `cargo build -p spectyra_ffi --release` | Runs `spectyra_run_chat_pipeline_json` locally, then your callback calls the provider with your keys. |

Spectyra **cloud** never receives prompts or provider secrets.

## Install (editable / monorepo)

```bash
cd sdks/python && pip install -e .
```

## Example (embedded pipeline + your OpenAI call)

```python
from spectyra import Spectyra, SpectyraConfig

spectyra = Spectyra(SpectyraConfig(
    mode="embedded",
    ffi_path="/path/to/libspectyra_ffi.dylib",
    spectyra_api_key="spk_...",  # optional cloud control plane
))

def call_openai(messages):
    # use openai-python with your env OPENAI_API_KEY
    ...

result = spectyra.run_chat(
    provider="openai",
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello"}],
    entitlement={...},  # camelCase — see Rust `FfiEntitlement` / OpenAPI
    call_provider=call_openai,
)
print(result.savings_amount, result.output)
```

## Example (runtime)

```python
from spectyra import Spectyra, SpectyraConfig

spectyra = Spectyra(SpectyraConfig(mode="runtime", runtime_base_url="http://127.0.0.1:4269"))
result = spectyra.run_chat_runtime(
    provider="openai",
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello"}],
)
```

## Tests

```bash
cd sdks/python && PYTHONPATH=src python3 -m unittest discover -s tests -p 'test_*.py' -q
```
