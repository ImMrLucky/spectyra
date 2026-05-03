# @spectyra/devtools

**Compatibility wrapper** — re-exports browser components and helpers from [`@spectyra/sdk`](https://www.npmjs.com/package/@spectyra/sdk).

**New installs should use:**

```bash
npm install @spectyra/sdk
```

```ts
import "@spectyra/sdk/auto"; // browser: overlay + monitoring side effects
// or explicit components:
import "@spectyra/sdk/overlay";
```

`import "@spectyra/devtools/auto"` remains available as a thin alias of `@spectyra/sdk/auto`.

## Legacy note

Older docs referenced `pnpm add @spectyra/devtools`. Use **npm** or your preferred package manager; `pnpm` is not required.
