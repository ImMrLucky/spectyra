# Permissions — Spectyra OpenClaw Plugin

Declared in `openclaw.plugin.json`:

| Permission   | Value |
|-------------|--------|
| **network** | `http://127.0.0.1:4111` only |
| **filesystem** | none (`[]`) |
| **shell** | `false` |
| **secrets** | `false` |

The plugin is designed so that **all runtime networking** targets the fixed local companion base URL. No broad host access is requested.
