# @spectyra/openclaw-skill

Published skill content lives in **`SKILL.md`** (OpenClaw / ClawHub). The install step pulls the **official scoped npm package** [`@spectyra/local-companion`](https://www.npmjs.com/package/@spectyra/local-companion) (Spectyra org — same publisher family as this skill). **`SKILL.md`** recommends **`npx --yes @spectyra/local-companion@latest start --open`** first so a **global** install is optional, not required.

**`skill.json`** and **`config-fragment.json`** use **`http://localhost:4111/v1`** for the provider `baseUrl` (scanner-friendly). **`SKILL.md`** documents the dashboard on **127.0.0.1** (port **4111**).

Before each publish, align the **same semver** everywhere: `SKILL.md` top-level `version`, `SKILL.md` → `metadata.openclaw.version`, `skill.json` top-level `version`, `skill.json` → `openclaw.version`, and `package.json` `version`.
