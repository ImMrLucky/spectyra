# @spectyra/openclaw-skill

Published skill content lives in **`SKILL.md`** (OpenClaw / ClawHub). **`skill.json`** and **`config-fragment.json`** use **`http://localhost:4111/v1`** for the provider `baseUrl` (OpenClaw scanner–friendly); **`SKILL.md`** still documents the dashboard on **127.0.0.1** (port **4111**).

Before each publish, align the **same semver** everywhere: `SKILL.md` top-level `version`, `SKILL.md` → `metadata.openclaw.version`, `skill.json` top-level `version`, `skill.json` → `openclaw.version`, and `package.json` `version`.
