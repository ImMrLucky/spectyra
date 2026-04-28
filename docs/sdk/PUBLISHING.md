# SDK and multi-language publishing

This document is for **maintainers** who release Spectyra SDKs. **End users** install from registries (npm, PyPI, Maven Central, NuGet, Go proxy) — see each SDK README; users should **not** need to clone the monorepo.

**Version alignment:** Keep `0.x` releases compatible across `sdks/python`, `sdks/java`, `sdks/dotnet`, `sdks/go`, and the JSON contracts consumed by `runtime/local-runtime` unless you document a breaking bump.

**Preflight (local):**

```bash
cd sdks/python && pip install -e ".[dev]" && python3 -m unittest discover -s tests -p 'test_*.py' -q
cd sdks/java && mvn -q test
cd sdks/dotnet && dotnet build
cd sdks/go && go test ./...
```

CI references: `.github/workflows/sdks-ci-publish.yml`, `runtime-rust.yml`, `pricing-registry-refresh.yml`, `sdk-openclaw-smoke.yml`. Phase checklist: [PHASED_CHECKLIST.md](./PHASED_CHECKLIST.md).

---

## `@spectyra/sdk` (npm)

- **Source:** `packages/sdk`
- **Publish:** npm with org tokens; version in `packages/sdk/package.json`.
- **Docs:** [README.md](../../packages/sdk/README.md)

---

## Rust (`runtime/*`, crates)

- **FFI / core:** Version crates with API contracts (pricing snapshot, telemetry payloads).
- **Build:** `cargo build -p spectyra_ffi --release` — see [RUST_AND_FFI_BUILD.md](./RUST_AND_FFI_BUILD.md).

---

## Python — PyPI (`spectyra`)

1. Bump `version` in `sdks/python/pyproject.toml` (PEP 440).
2. From `sdks/python`: `rm -rf dist build *.egg-info` then `python -m build` (requires `build` package).
3. Upload with **Twine** and a **PyPI API token** (`TWINE_USERNAME=__token__`):
   - `twine upload --repository testpypi dist/*` then production `twine upload dist/*`.
4. Verify: `pip install spectyra==<version>` in a clean virtualenv.

**PyPI project name:** `spectyra`.

---

## Java — Maven Central (`ai.spectyra:spectyra-sdk`)

1. Bump `<version>` in `sdks/java/pom.xml` (Central releases should not use `-SNAPSHOT`).
2. Ensure coordinates match README: `groupId` `ai.spectyra`, `artifactId` `spectyra-sdk`.
3. Publish via **OSSRH / Central Portal** with GPG-signed artifacts, `-sources`, and `-javadoc` jars (Maven Central requirements).
4. Close and **release** the staging repository in Sonatype.
5. Verify search: [central.sonatype.com](https://central.sonatype.com/) for `spectyra-sdk`.

---

## .NET — NuGet (`Spectyra.SDK`)

1. Bump `<Version>` in `sdks/dotnet/Spectyra.SDK.csproj`; keep `<PackageId>Spectyra.SDK</PackageId>`.
2. `dotnet pack sdks/dotnet/Spectyra.SDK.csproj -c Release -o ../../dist/nuget`
3. `dotnet nuget push dist/nuget/*.nupkg --api-key <NUGET_API_KEY> --source https://api.nuget.org/v3/index.json`
4. Verify: `dotnet add package Spectyra.SDK --version <version>`.

---

## Go — module `github.com/spectyra/spectyra-go`

The **module path** is `github.com/spectyra/spectyra-go`; the **implementation** currently lives under this monorepo in `sdks/go/`.

**Publishing options:**

1. **Dedicated repository (recommended for `go get`):** Maintain `github.com/spectyra/spectyra-go` whose **repository root** contains the `go.mod`, `go.sum`, and `spectyra/` package tree (mirror or subtree split from `sdks/go`). Tag **`v0.1.0`**, `v0.1.1`, … with the `v` prefix. Consumers run:
   - `go get github.com/spectyra/spectyra-go@v0.1.0`
2. **Monorepo-only (contributor / fork):** Consumers can use a `replace` directive in `go.mod` pointing at a local path or a `git` URL to this repo’s `sdks/go` until option (1) is live.

**Import path:** `github.com/spectyra/spectyra-go/spectyra`.

---

## Registry secrets (summary)

| Registry        | Typical secret / method        |
|-----------------|---------------------------------|
| npm             | `NPM_TOKEN`, automation token   |
| PyPI            | API token, trusted publishing   |
| Maven Central   | OSSRH username/password, GPG key|
| NuGet           | API key with push scope       |
| Go              | Git tag push to module repo     |

Run uploads from a **protected** CI environment or release workstation — never commit tokens.
