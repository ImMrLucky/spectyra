/**
 * @spectyra/optimization-engine
 *
 * Full optimization pipeline — ALL algorithms run locally in-process.
 * Zero customer data leaves the customer's environment.
 *
 * License model:
 *   - Valid trial or paid → full optimization applied, all efficiencies
 *   - No valid license → observe-only: user SEES what they'd save, gets none.
 *     Drives conversion — show the value, prompt activation.
 */
export {
  optimize,
  registerTransform,
  activateLicense,
  deactivateLicense,
  getLicenseStatus,
  type OptimizeInput,
} from "./engine.js";

export { whitespaceNormalize } from "./transforms/whitespace-normalize.js";
export { dedupConsecutive } from "./transforms/dedup-consecutive.js";
export { assistantSelfQuoteDedup } from "./transforms/assistant-self-quote-dedup.js";
export { systemDedup } from "./transforms/system-dedup.js";
export { toolOutputTruncate } from "./transforms/tool-output-truncate.js";
export { jsonMinify } from "./transforms/json-minify.js";
export { errorStackCompressor } from "./transforms/error-stack-compressor.js";
export { contextWindowTrim } from "./transforms/context-window-trim.js";
export { stableTurnSummarize } from "./transforms/stable-turn-summarize.js";
export { spectralSCC } from "./transforms/spectral-scc.js";
export { refpackTransform } from "./transforms/refpack-transform.js";
export { phrasebookTransform } from "./transforms/phrasebook-transform.js";
export { codemapTransform } from "./transforms/codemap-transform.js";
export { deltaPromptingTransform } from "./transforms/delta-prompting.js";
export { codeSlicerTransform } from "./transforms/code-slicer.js";
export { patchModeTransform } from "./transforms/patch-mode.js";

export {
  postProcessOutput,
  type PostProcessInput,
} from "@spectyra/optimizer-algorithms";

export {
  runQualityGuard,
  type RequiredCheck,
  type QualityGuardInput,
  type QualityGuardResult,
} from "@spectyra/optimizer-algorithms";

export {
  profitGate,
  TALK_PROFIT_GATE,
  CODE_PROFIT_GATE,
  type ProfitGateOptions,
  type ProfitGateResult,
} from "@spectyra/optimizer-algorithms";

export {
  computeBudgetsFromSpectral,
  type BudgetsFromSpectralInput,
  type Budgets,
} from "@spectyra/optimizer-algorithms";
