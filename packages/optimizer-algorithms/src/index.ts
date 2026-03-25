export type {
  PathKind, SemanticUnitKind, SemanticUnit, GraphEdge, SignedGraph,
  SpectralOptions, SpectralResult, Budgets, ProfitGateOptions, ProfitGateResult,
  ChatMsg, TextSegment,
} from "./types.js";

export { clamp01, sigmoid, dot, norm2, normalize, cosine, estimateTokens, estimateInputTokens, escapeRegex } from "./math.js";

export { buildSignedAdjacency, buildSignedLaplacian } from "./spectral/signedLaplacian.js";
export { matVec, rayleighQuotient, estimateLambda2, orthogonalizeToOnes } from "./spectral/powerIteration.js";
export { computeCombinedStabilityIndex, computeStabilityIndex, computeStabilityIndexV2 } from "./spectral/stabilityIndex.js";
export type { StabilityComponents, StabilityResult } from "./spectral/stabilityIndex.js";
export { computeRandomWalkGap } from "./spectral/randomWalk.js";
export { computeCurvatureStats } from "./spectral/curvature.js";
export type { CurvatureStats } from "./spectral/curvature.js";
export { computeHeatTraceComplexity } from "./spectral/heatTrace.js";
export { computeNodeFeatures, getAverageNovelty } from "./spectral/nodeFeatures.js";
export type { NodeFeatures } from "./spectral/nodeFeatures.js";
export { contradictionEnergy, spectralAnalyze } from "./spectral/spectralCore.js";
export type { ConversationMetrics, SpectralAnalyzeInput } from "./spectral/spectralCore.js";

export { buildSimilarityEdges } from "./edgeBuilders/similarityEdges.js";
export { buildContradictionEdges } from "./edgeBuilders/contradictionEdges.js";
export { buildDependencyEdges } from "./edgeBuilders/dependencyEdges.js";

export { unitizeMessages } from "./unitize.js";
export type { UnitizeOptions, UnitizeInput } from "./unitize.js";
export { buildGraph } from "./buildGraph.js";
export type { BuildGraphInput } from "./buildGraph.js";

export { computeBudgetsFromSpectral } from "./budgets.js";
export type { BudgetsFromSpectralInput } from "./budgets.js";
export { profitGate, TALK_PROFIT_GATE, CODE_PROFIT_GATE } from "./profitGate.js";

export { compileTalkState, compileCodeState } from "./contextCompiler.js";
export type {
  CompileTalkStateInput, CompileTalkStateOutput,
  CompileCodeStateInput, CompileCodeStateOutput,
} from "./contextCompiler.js";

export { buildRefPack, applyInlineRefs, buildRefPackSystemMessage } from "./refPack.js";
export type { RefPack, RefPackInput, RefPackOutput, ApplyInlineRefsInput, ApplyInlineRefsOutput } from "./refPack.js";

export { buildLocalPhraseBook } from "./phraseBook.js";
export type { PhraseBook, PhraseBookInput, PhraseBookOutput } from "./phraseBook.js";

export { buildCodeMap } from "./codeMap.js";
export type { CodeMap, CodeMapInput, CodeMapOutput } from "./codeMap.js";

export { buildSTE } from "./ste.js";
export type { STE, STEInput, STEOutput } from "./ste.js";

export { splitByFencedCode, replaceOnlyOutsideCodeFences, isInsideCodeFence, extractCodeBlockContents } from "./textGuards.js";

export {
  normalizeBullet, dedupeOrdered, dedupeUserSentencesKeepLast,
  normalizePath, dedupeFailingSignals,
} from "./scc/normalize.js";
export type { FailingSignal } from "./scc/normalize.js";

export {
  extractConstraints, extractFailingSignals, extractConfirmedTouchedFiles,
  extractLatestToolFailure, countRecentFailingSignals, detectRepeatingErrorCodes,
} from "./scc/extract.js";
export type { ExtractedConstraints } from "./scc/extract.js";
