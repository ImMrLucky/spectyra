# @spectyra/auto

**Compatibility wrapper** — this package re-exports [`@spectyra/sdk/auto`](https://www.npmjs.com/package/@spectyra/sdk).

**New installs should use:**

```bash
npm install @spectyra/sdk
```

```ts
import "@spectyra/sdk/auto";
```

That entry includes Node monitoring (fetch / HTTP / axios where applicable), JSONL, dev bridge hooks, and browser overlay behavior via package `exports` — you do **not** need `@spectyra/devtools` for the default overlay story.

Keeping `@spectyra/auto` avoids breaking older tutorials that still show `import "@spectyra/auto"`.
