# Release notes: `SpectyraQuotaState` and entitlements (SDK + API)

## Summary

Public TypeScript types gained additional **blocked / account** quota states and optional **`SpectyraQuotaStatus.detail`** for in-app copy. The SDK entitlement runtime now surfaces **`missing_api_key`** when entitlements are enabled without resolvable cloud credentials, and **`account_deleted`** when the API signals lifecycle deletion or when refresh receives **HTTP 404 / 410**.

## Breaking changes

- **None for existing string literals** that already matched the union: new states are additive.
- Integrations that **switch exhaustively** on `SpectyraQuotaState` (without a default branch) must handle the new members: `missing_api_key`, `account_deleted`, and any other states present in `packages/sdk/src/observability/observabilityTypes.ts`.

## API

- `GET /v1/entitlements/status` may include `orgLifecycleStatus` (`"active"` | `null` today; `"deleted"` when tombstone semantics are wired end-to-end).

## Migration

1. Recompile / redeploy consumers that pattern-match on quota state.
2. Ensure dashboards that assumed only `"active_free"` / `"active_paid"` read **`canRunOptimized`** and optional **`detail`**.
