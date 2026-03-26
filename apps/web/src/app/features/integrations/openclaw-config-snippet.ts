/**
 * OpenClaw `models.providers` example — kept in the web app bundle (not workspace packages)
 * so the desktop Angular build does not need to compile `packages/shared` from source paths.
 * Keep in sync with `packages/shared/src/openclawConfigExample.ts`.
 */
export const OPENCLAW_CONFIG_EXAMPLE_JSON = `{
  "models": {
    "providers": {
      "spectyra": {
        "baseUrl": "http://127.0.0.1:4111/v1",
        "apiKey": "SPECTYRA_LOCAL",
        "api": "openai-completions",
        "models": [
          {
            "id": "smart",
            "name": "Spectyra Smart",
            "contextWindow": 128000,
            "maxTokens": 8192
          },
          {
            "id": "fast",
            "name": "Spectyra Fast",
            "contextWindow": 128000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "spectyra/smart"
      }
    }
  }
}`;
