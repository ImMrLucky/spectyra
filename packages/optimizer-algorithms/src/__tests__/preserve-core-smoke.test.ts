/**
 * Preserve-first regression smoke: exercises stable exports from @spectyra/optimizer-algorithms
 * without asserting deep numerical behavior (those belong in focused unit tests).
 *
 * Run: pnpm --filter @spectyra/optimizer-algorithms run test:preserve-smoke
 */

import assert from "node:assert";
import { clamp01, estimateTokens } from "../math.js";
import { contradictionEnergy, spectralAnalyze } from "../spectral/spectralCore.js";
import type { SignedGraph, SpectralOptions } from "../types.js";

const defaultOpts: SpectralOptions = {
  tLow: 0.3,
  tHigh: 0.7,
  maxNodes: 128,
  similarityEdgeMin: 0.2,
  contradictionEdgeWeight: 0.5,
};

// --- Math / guards
assert.strictEqual(clamp01(-1), 0);
assert.strictEqual(clamp01(2), 1);
assert.ok(estimateTokens("hello world") > 0);

// --- Spectral: trivial graph short-circuit (no Laplacian path)
const trivial: SignedGraph = { n: 2, edges: [] };
const trivialResult = spectralAnalyze(trivial, defaultOpts);
assert.strictEqual(trivialResult.nNodes, 2);
assert.strictEqual(trivialResult.recommendation, "EXPAND");

// --- Contradiction energy
const mixed: SignedGraph = {
  n: 2,
  edges: [{ i: 0, j: 1, w: -0.5, type: "contradiction" }],
};
assert.ok(contradictionEnergy(mixed) > 0);

console.log("✅ preserve-core-smoke: core optimizer-algorithms exports behave as expected.");
