/**
 * Example OpenClaw `models.providers` + default agent config.
 * Copy into OpenClaw config; `spectyra/smart` routes to the real model
 * chosen in Spectyra Desktop (same localhost base URL).
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
