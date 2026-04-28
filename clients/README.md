# `clients/` — legacy / internal notes

This directory held **early integration sketches** split by language. It is **not** where new SDK work happens.

**Use instead**

- **Published SDKs:** `pip install spectyra`, Maven `ai.spectyra:spectyra-sdk`, NuGet `Spectyra.SDK`, Go `github.com/spectyra/spectyra-go` — see [`sdks/`](../sdks/) and each language README.
- **Architecture:** [`docs/sdk/README.md`](../docs/sdk/README.md)

Do not add new production code under `clients/`; extend [`sdks/`](../sdks/).
