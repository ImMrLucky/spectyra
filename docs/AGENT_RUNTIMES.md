# Agent runtimes and how Spectyra fits

Spectyra is **not** a replacement for coding agents or IDEs. It **optimizes token usage** and surfaces **local analytics** while your existing tools keep calling **your** LLM providers (BYOK).

## OpenClaw

- **What it is:** A local CLI-style agent runtime; users install it from **openclaw.ai** (see [INSTALL_AND_SETUP.md](./INSTALL_AND_SETUP.md#openclaw-official-installer)).
- **Node:** OpenClaw expects **Node.js 22.14+**.
- **Spectyra:** Users point OpenClaw’s OpenAI-compatible API base URL at the **Local Companion** (`http://127.0.0.1:4111/v1` by default). Inference still goes **directly** to OpenAI / Anthropic / etc.; Spectyra optimizes locally and never replaces the user’s provider key.

## Other runtimes the product guides you through

These are **categories** in the Desktop **Agent Companion** wizard, not endorsements of a single vendor:

| Runtime | Typical tools | How Spectyra attaches |
|--------|----------------|------------------------|
| **Claude** | Claude Code, hooks, MCP | Custom base URL where supported, hooks / **ingest** for events |
| **OpenAI Agents** | Agents SDK, tracing | Tracing or companion endpoint + **ingest** |
| **SDK app** | Your own Node app | `@spectyra/sdk` in-process |
| **Generic endpoint** | Any OpenAI/Anthropic-compatible client | `OPENAI_BASE_URL` / `ANTHROPIC_BASE_URL` → companion |
| **Logs / JSONL** | Custom or documented log pipelines | Tail + `POST /v1/analytics/ingest` |

“Competitors” in the broader market (other AI coding assistants, IDEs with agents) are **out of scope** unless they expose a **custom API URL**, **hooks**, or **structured logs** — then the same tiers in [AGENTIC_AND_SERVER_INTEGRATION.md](./AGENTIC_AND_SERVER_INTEGRATION.md) apply.

## One-line positioning

**OpenClaw / Claude / OpenAI Agents / your SDK app** run the workflow; **Spectyra** reduces cost and adds observability on the side.
