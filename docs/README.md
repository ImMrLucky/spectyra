## Docs index

Keep this folder **user-facing and current**.

### Start here

- **Quickstart**: [`QUICKSTART.md`](./QUICKSTART.md)
- **User Guide**: [`USER_GUIDE.md`](./USER_GUIDE.md)
- **Application Description**: [`APPLICATION_DESCRIPTION.md`](./APPLICATION_DESCRIPTION.md)

### Studio + SDK integration

- **Claude Code integration**: [`CLAUDE_CODE_INTEGRATION.md`](./CLAUDE_CODE_INTEGRATION.md)
- **Claude agent integration**: [`CLAUDE_AGENT_INTEGRATION.md`](./CLAUDE_AGENT_INTEGRATION.md)

### Security & data

- **Security**: [`ENTERPRISE_SECURITY.md`](./ENTERPRISE_SECURITY.md) and [`.github/SECURITY.md`](../.github/SECURITY.md)
- **Threat model**: [`THREAT_MODEL.md`](./THREAT_MODEL.md)
- **Data handling**: [`DATA_HANDLING.md`](./DATA_HANDLING.md)
- **Retention**: [`RETENTION.md`](./RETENTION.md)

### Configuration

- **Environment variables**: [`ENVIRONMENT_VARIABLES.md`](./ENVIRONMENT_VARIABLES.md)

### Moat architecture (engineering)

Start with **[`MOAT_UPGRADE_ROADMAP.md`](./MOAT_UPGRADE_ROADMAP.md)** (phases, commands, what shipped). **[`PRESERVE_FIRST_BOUNDARIES.md`](./PRESERVE_FIRST_BOUNDARIES.md)** is the IP/boundary inventory. Policy rules and package layout: **[`WORKFLOW_POLICY_ENGINE.md`](./WORKFLOW_POLICY_ENGINE.md)**.

Optional deeper notes (no need to read every file for every phase): [`WHY_SPECTYRA_IS_AN_OPTIMIZATION_LAYER.md`](./WHY_SPECTYRA_IS_AN_OPTIMIZATION_LAYER.md), [`LOCAL_EVENT_SPINE.md`](./LOCAL_EVENT_SPINE.md), [`LOCAL_ANALYTICS_AND_SYNC.md`](./LOCAL_ANALYTICS_AND_SYNC.md), [`EXECUTION_GRAPH.md`](./EXECUTION_GRAPH.md), [`STATE_DELTA_OPTIMIZATION.md`](./STATE_DELTA_OPTIMIZATION.md), [`LEARNING_MODEL.md`](./LEARNING_MODEL.md), [`STAYING_AHEAD_OF_PROVIDER_EVOLUTION.md`](./STAYING_AHEAD_OF_PROVIDER_EVOLUTION.md).

**Regression:** `pnpm test:moat-phase1-2` (1–2) · `pnpm test:moat-through-4` (through 4) · `pnpm test:moat-through-5` (through 5) · `pnpm test:moat-through-6` (through 6).
