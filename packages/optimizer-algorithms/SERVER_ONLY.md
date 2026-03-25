# @spectyra/optimizer-algorithms — IP Protection

This package contains **proprietary Spectyra optimization algorithms**:

- Spectral analysis (λ₂, random walk, heat trace, curvature)
- PG-SCC (Spectral Context Compiler)
- RefPack (reference compression)
- PhraseBook / STE (phrase encoding)
- CodeMap (code block compression)
- Unitization (semantic unit extraction)
- Budgets (spectral-driven budget control)
- Profit gate (net-positive enforcement)

## Data Safety

All algorithms run **locally in-process** on the customer's machine.
**ZERO customer data** (prompts, code, messages) ever leaves the customer's environment.

## IP Protection

1. **Private package**: `"private": true` — never published to npm
2. **Compiled distribution**: SDK/desktop ship compiled + minified JS, not TypeScript source
3. **License gating**: Full pipeline requires a valid Spectyra license key at runtime
4. **Browser exclusion**: Only `@spectyra/engine-client` (lightweight transforms) runs in browsers
5. **Node.js only**: The full engine runs in SDK (Node.js backend), Desktop (Electron main), Companion (Node.js process)

## Rules

1. **NEVER publish this package to npm** (`"private": true`)
2. **NEVER bundle TypeScript source** into distributed artifacts — compile to JS first
3. Browser/web code must use `@spectyra/engine-client` instead
4. The optimization engine gates access with `activateLicense()` / `licenseValid`
