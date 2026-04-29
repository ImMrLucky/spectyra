# Python monitoring (Phases 3–4)

Implementation lives in **`sdks/python`** (package name `spectyra` on PyPI path from this repo).

## Phase 3 — `spectyra.monitor`

- **`MonitorEngine`** — ring buffer, `record_event`, `get_monitor_summary`, `get_recent_monitor_events`, optional JSONL (`spectyra.monitor.engine`).
- **Redaction / summaries** — `scrub_monitor_event_for_persistence`, `build_monitor_summary_from_events`, `empty_monitor_summary`.
- **Provider host hints** — `detect_provider_from_host` (subset of TS rules).

```python
from spectyra.monitor import MonitorEngine

engine = MonitorEngine(jsonl_path="./logs/monitor.jsonl")
engine.record_event({"provider": "openai", "model": "gpt-4o-mini", "latencyMs": 40, "success": True})
print(engine.get_monitor_summary())
```

## Phase 4 — auto (`spectyra.automation`)

- **`start_spectyra_auto`** / **`stop_spectyra_auto`** / **`get_auto_monitor_engine`** — singleton engine + **`urllib.request.urlopen`** monkey-patch to parse JSON LLM responses on known provider paths (metadata only).
- Best-effort parity with Node `@spectyra/auto` for code paths that use stdlib urllib. Libraries that use **httpx** or raw sockets are not covered unless they go through `urlopen`.

```python
from spectyra import start_spectyra_auto, stop_spectyra_auto

start_spectyra_auto(jsonl_path="./logs/monitor.jsonl", project="my-api")
# ... app traffic ...
stop_spectyra_auto()
```

## Tests

From repo root:

```bash
cd sdks/python && pip install -e ".[dev]" && PYTHONPATH=src python3 -m unittest discover -s tests -p 'test_*.py' -v
```
