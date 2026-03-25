# Feature Detection System

The feature detection system is what makes Spectyra adaptable without hard-coding per tool or per provider. Detectors analyze the structure and patterns of canonical requests, not vendor names.

## Package

`@spectyra/feature-detection`

## Design principles

1. **Structure-based** — Detectors look at message patterns, token counts, repetition, context shape
2. **Vendor-blind** — No detector checks `provider === "openai"` or `tool === "openclaw"`
3. **Calibratable** — Learning profiles can adjust detector confidence thresholds over time
4. **Composable** — Each detector is independent; the engine runs all and merges results

## Detector interface

```typescript
interface FeatureDetector {
  id: string;
  category: DetectorCategory;
  detect(input: CanonicalRequest, history?: HistoricalSignals): FeatureDetectionResult[];
}
```

## Detection result

```typescript
interface FeatureDetectionResult {
  featureId: string;     // e.g. "duplication/repeated_messages"
  confidence: number;    // 0..1
  severity?: "low" | "medium" | "high";
  evidence?: string[];   // human-readable evidence
  metrics?: Record<string, number>;
}
```

## Detector categories

### Duplication (`duplication/`)

| Detector | What it finds |
|----------|--------------|
| `repeated_messages` | Exact-duplicate messages in conversation |
| `repeated_system` | Multiple system messages with identical content |
| `repeated_tool_outputs` | Tool outputs that appear multiple times |

### Context bloat (`context_bloat/`)

| Detector | What it finds |
|----------|--------------|
| `oversized_history` | Conversation history exceeding ~4k estimated tokens |
| `oversized_system` | System prompt exceeding ~2k estimated tokens |
| `unreferenced_bundles` | Context bundles not referenced by any message |
| `redundant_schema` | Tool definitions with duplicate input schemas |

### Agent flow (`agent_flow/`)

| Detector | What it finds |
|----------|--------------|
| `recursive_planning` | Multiple assistant messages with planning language |
| `repeated_reasoning` | Similar reasoning blocks repeated across steps |
| `tool_result_reinclusion` | Tool outputs consuming >50% of total context |
| `context_growth` | Second half of conversation >1.5x the first half |

### Structural opportunities (`structural/`)

| Detector | What it finds |
|----------|--------------|
| `large_code_blocks` | Code blocks >500 chars (codemap candidates) |
| `repeated_phrases` | 8-word phrases repeated >2 times (phrasebook candidates) |
| `stable_turns` | Older turns that haven't changed (summarization candidates) |
| `repeated_references` | Context bundles marked as repeated |

### Output/safety constraints (`output_constraints/`, `safety_constraints/`)

| Detector | What it finds |
|----------|--------------|
| `json_required` | Policy or system prompt requests JSON output |
| `code_required` | Policy requests code output |
| `determinism_required` | Policy prioritizes deterministic output |
| `recent_turns_preserved` | Policy requires preserving N recent turns |
| `exact_sections_preserved` | Policy names exact sections to preserve |
| `sensitive_content` | Security metadata flags sensitive content |

## How transforms use features

Each transform declares an `applies()` method that checks detected features:

```typescript
// This transform only runs when duplication is detected
applies(features) {
  return features.some(f => f.featureId.startsWith("duplication/"));
}
```

This decouples "what to detect" from "what to do about it."

## Calibration via learning

The learning profile can override confidence thresholds per detector:

```typescript
const calibration = getDetectorCalibration(profile);
const features = detectFeatures(request, history, calibration);
```

If a detector repeatedly triggers transforms that hurt output quality, the learning system lowers its effective confidence.

## Adding a new detector

1. Implement `FeatureDetector` in a new file under `src/detectors/`
2. Add it to the appropriate category array
3. Register it in `src/engine.ts` or via `registerDetector()`
4. **Do not reference vendor/tool names** — the anti-coupling test will catch it
