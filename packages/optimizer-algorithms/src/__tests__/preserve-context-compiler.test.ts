/**
 * Phase 1: SCC talk-path context compiler smoke — must keep emitting tagged state blocks.
 */
import assert from "node:assert";
import { compileTalkState } from "../contextCompiler.js";
import type { Budgets, ChatMsg, SpectralResult } from "../types.js";

const budgets: Budgets = {
  keepLastTurns: 1,
  maxRefpackEntries: 6,
  minRefpackSavings: 30,
  compressionAggressiveness: 0.5,
  phrasebookAggressiveness: 0.5,
  codemapDetailLevel: 0.7,
  stateCompressionLevel: 0.5,
  maxStateChars: 4000,
  retainToolLogs: true,
};

const spectral: SpectralResult = {
  nNodes: 0,
  nEdges: 0,
  lambda2: 0,
  contradictionEnergy: 0,
  stabilityIndex: 0.5,
  recommendation: "EXPAND",
  stableNodeIdx: [],
  unstableNodeIdx: [],
};

const messages: ChatMsg[] = [
  { role: "user", content: "Build a small API for todos." },
  { role: "assistant", content: "I will scaffold Express routes and tests." },
];

const out = compileTalkState({ messages, units: [], spectral, budgets });
assert.strictEqual(out.stateMsg.role, "system");
assert.ok(out.stateMsg.content.includes("[SPECTYRA_STATE_TALK]"));
assert.ok(out.stateMsg.content.includes("[/SPECTYRA_STATE_TALK]"));
assert.ok(out.keptMessages.length >= 1);

console.log("✅ preserve-context-compiler: talk state compile path ok");
