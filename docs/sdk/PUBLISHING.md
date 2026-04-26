# SDK and multi-language publish policy

This document records **versioning and release expectations** for Spectyra SDK surfaces. CI publish jobs to PyPI, Maven Central, NuGet, and pkg.go.dev are tracked in `docs/sdk/PHASED_CHECKLIST.md` (Phase 7).

## `@spectyra/sdk` (npm)

- **Source of truth:** `packages/sdk` in the monorepo.
- **Version:** Bumps with the rest of the workspace via the root release process; keep `CHANGELOG` entries aligned with breaking changes to `SpectyraQuotaState` and public hooks.

## Rust (`runtime/*`, crates)

- **FFI / core:** Version crates together with API contracts that consume serialized JSON (pricing snapshot, telemetry payloads).
- **CI:** `.github/workflows/runtime-rust.yml` runs `cargo build` and `cargo test` on `runtime/`.

## `sdks/python`, `sdks/java`, `sdks/dotnet`, `sdks/go`

- **Scaffolds:** Each tree owns its manifest (`pyproject.toml`, `pom.xml`, etc.) and README for **runtime HTTP** and optional **embedded FFI** paths.
- **Publish:** Pin major versions to compatible API + JSON contracts; add release tags only after `PHASED_CHECKLIST.md` Phase 7 publish items are checked off.

## CI (build / publish-ready)

- **Multi-language SDK matrix:** `.github/workflows/sdks-ci-publish.yml` (Python venv + `build` / `pytest`, Maven, `dotnet build`, `go test`).
- **Pricing DB ingest:** `.github/workflows/pricing-registry-refresh.yml` (requires `DATABASE_URL` GitHub secret; skips cleanly if unset).
- **OpenClaw smoke:** `.github/workflows/sdk-openclaw-smoke.yml`.

Registry uploads (PyPI, Maven Central, NuGet, pkg.go.dev) still require project-specific secrets and release tagging; use the workflows above as preflight, then attach artifacts or run `twine` / `goreleaser` / `dotnet nuget push` from a protected environment.
