# Learning Model

Spectyra gets smarter over time at two scopes:

1. **Local** — per-app, per-workflow, per-install. Richer data, stays on the customer machine.
2. **Global** — aggregated, non-sensitive metrics. Used for cross-customer improvement.

## Package

`@spectyra/learning`

## Local learning

### What it stores

| Data | Allowed locally | Example |
|------|-----------------|---------|
| Transform success/failure | Yes | "codemap succeeded 85% of the time" |
| Average token savings | Yes | "stable_turn_summarize saves ~1200 tokens" |
| Quality scores | Yes | "dedup had 0.92 quality retention" |
| Stable pattern fingerprints | Yes | "system prompt hash X appears in 90% of runs" |
| Workflow-specific preferences | Yes | "this app prefers aggressive compression" |
| Raw prompts | Yes (local storage) | Stored in `~/.spectyra/companion/` |

### LearningProfile

```typescript
interface LearningProfile {
  scopeId: string;
  transformPreferences: Record<string, TransformPreference>;
  stablePatterns?: StablePatternSummary[];
  detectorCalibration?: Record<string, number>;
}
```

### How local learning works

1. After each optimization run, record a `LearningUpdate` with transform ID, success, tokens saved, and quality score
2. `applyUpdate()` uses exponential moving average (alpha=0.2) to smoothly update success rates and savings metrics
3. `recordStablePattern()` tracks repeated structural patterns by hash
4. `toHistoricalSignals()` converts the profile into signals that feature detectors can use
5. `getDetectorCalibration()` provides per-detector threshold overrides

### Local learning influences

- **Transform selection**: Transforms with low local success rate are deprioritized
- **Detector thresholds**: Detectors that trigger poorly-performing transforms get higher confidence requirements
- **Aggressiveness**: Workflows that tolerate aggressive optimization get more of it

## Global learning

### What it stores

| Data | Allowed globally | Forbidden |
|------|-----------------|-----------|
| Aggregate transform success rates | Yes | Raw prompts |
| Aggregate token savings | Yes | Raw responses |
| Quality retention scores | Yes | Customer files or code |
| Feature IDs and counts | Yes | Customer identifiers |
| Detector hit rates | Yes | Individual run data |

### GlobalLearningSnapshot

```typescript
interface GlobalLearningSnapshot {
  generatedAt: string;
  transformBenchmarks: Record<string, TransformBenchmark>;
  detectorThresholdUpdates: Record<string, number>;
}
```

### How global learning works

1. `aggregateProfiles()` combines multiple local profiles into a global snapshot, using only non-sensitive aggregate metrics
2. `getGlobalDefault()` provides fallback benchmarks for transforms when no local data exists
3. `getGlobalDetectorThreshold()` provides fallback threshold adjustments

### Application priority

The optimizer uses learning in this order:

1. **Local profile** — most specific, most trusted
2. **Global defaults** — cross-customer benchmarks
3. **Static defaults** — hardcoded conservative thresholds

This gives personalization, cross-customer improvement, and a safe privacy posture.

## Security constraints

### Local learning security

Local learning stays in the customer environment. It can use richer data:
- Stable repeated phrase patterns
- Repeated structure fingerprints
- Prompt shape summaries
- Workflow-specific transform history

### Global learning security

Global learning must never depend on raw prompt content. Enforced by:
- Only aggregate metrics in `GlobalLearningSnapshot`
- No fields for raw text, code, or files
- `@spectyra/security-core` validates what can be synced

## Implementation status (Phase 5)

- **Transform selection** — `optimization-engine` skips heavy transforms (`spectral_scc`, `refpack`, `phrasebook`, `codemap`, `stable_turn_summarize`) when local `LearningProfile` shows sustained failure (`shouldSkipTransformForLearning` in `@spectyra/learning`).
- **Feature detection** — `detectFeatures(request, toHistoricalSignals(profile), mergeCalibrationForDetection(profile, global))` in **Local Companion** (`optimizer.ts`) and **SDK** (`localWrapper.ts` when `learningProfile` / `globalLearningSnapshot` are set).
- **Feedback** — `learningUpdatesFromPipelineRun` + `applyUpdate` after each run; Companion persists **`~/.spectyra/companion/learning-profile.json`**.
- **SDK** — Optional `SpectyraConfig.learningProfile` and `globalLearningSnapshot`; export `createEmptyProfile` / `applyUpdate` from `@spectyra/sdk`.

Tests: `pnpm test:learning-loop`, full moat `pnpm test:moat-through-5`.
