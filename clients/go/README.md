# Spectyra local runtime — Go integration

Go backends can treat the Spectyra runtime as a **localhost sidecar** or an in-process supervisor that exposes a single HTTP port.

## Requirements

- Base URL **`http://127.0.0.1:4269`** unless overridden via `SPECTYRA_RUNTIME_BIND`.
- Provider keys exported for the **runtime binary**, not baked into Go binaries if avoidable — inject via orchestrator secrets.

## Architecture reminder

```
Go service  →  POST /v1/chat/run  →  Spectyra runtime  →  Vendor HTTPS
```

Spectyra cloud receives **account control-plane + aggregates** only when configured — never prompts.

### Pseudocode

```go
payload := map[string]any{
  "provider": "openai",
  "model":    "gpt-4o-mini",
  "messages": []map[string]string{
    {"role": "system", "content": "You are concise."},
    {"role": "user", "content": "Explain savings estimates."},
  },
  "metadata": map[string]string{
    "environment": "staging",
    "projectId":   "payments",
  },
}
b, _ := json.Marshal(payload)
req, _ := http.NewRequest(http.MethodPost, "http://127.0.0.1:4269/v1/chat/run", bytes.NewReader(b))
req.Header.Set("Content-Type", "application/json")

res, err := http.DefaultClient.Do(req)
// Decode JSON: inspect top-level `output` for provider data,
// floats for savings, and `quotaStatus` for gating banners.
```

## Savings vs quota

- **`savingsAmount` / `savingsPercent`**: ideal for Prometheus gauges or structured logs **without** storing prompts.
- **`quotaStatus`**: expose via your admin UI; states like `quota_exhausted` mean Spectyra optimization features should pause — provider calls may still succeed depending on runtime policy.

## Spec

See `runtime/contracts/openapi/spectyra-runtime.openapi.yaml`.
