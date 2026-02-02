/**
 * Spectral Context Compiler (SCC) — PG-SCC
 *
 * Produces a single compact "state message" and drops most of the old history.
 * Talk: [SPECTYRA_STATE_TALK] ... [/SPECTYRA_STATE_TALK]
 * Code: [SPECTYRA_STATE_CODE] ... [/SPECTYRA_STATE_CODE]
 *
 * Uses scc/normalize and scc/extract for deterministic, deduped, compact output.
 */

import type { ChatMessage } from "@spectyra/shared";
import type { SemanticUnit, SpectralResult } from "../spectral/types";
import type { Budgets } from "../budgeting/budgetsFromSpectral";
import {
  normalizeBullet,
  dedupeOrdered,
  normalizePath,
  dedupeFailingSignals,
} from "./scc/normalize.js";
import {
  extractConstraints,
  extractFailingSignals,
  extractTouchedFiles,
} from "./scc/extract.js";

export interface CompileTalkStateInput {
  messages: ChatMessage[];
  units: SemanticUnit[];
  spectral: SpectralResult;
  budgets: Budgets;
}

export interface CompileTalkStateOutput {
  stateMsg: ChatMessage;
  keptMessages: ChatMessage[];
  droppedCount: number;
}

export interface CompileCodeStateInput {
  messages: ChatMessage[];
  units: SemanticUnit[];
  spectral: SpectralResult;
  budgets: Budgets;
}

export interface CompileCodeStateOutput {
  stateMsg: ChatMessage;
  keptMessages: ChatMessage[];
  droppedCount: number;
}

const MAX_BULLET_LEN = 120;
const MAX_CONSTRAINT_LINE = 200;
const MAX_TOUCHED_FILES = 15;
const MAX_FAILING_SIGNALS_AFTER_LATEST = 8;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trim() + "…";
}

/** Build deduped constraint list; always include ES target + optional chaining bans if present. */
function buildConstraintsBlock(extracted: ReturnType<typeof extractConstraints>): string {
  const global = dedupeOrdered(extracted.global).slice(0, 20);
  if (global.length === 0) return "- (none)";
  return global.map((c) => `- ${truncate(normalizeBullet(c), MAX_CONSTRAINT_LINE)}`).join("\n");
}

function getLastNTurns(messages: ChatMessage[], n: number): ChatMessage[] {
  const nonSystem = messages.filter((m) => m.role !== "system");
  const turns = Math.min(n, Math.ceil(nonSystem.length / 2));
  const keepCount = Math.min(nonSystem.length, turns * 2);
  return nonSystem.slice(-keepCount);
}

/** Last N turns plus all tool messages after the last user message. SCC invariant: preserve tool output after last user turn. */
function getLastNTurnsPlusToolOutputs(messages: ChatMessage[], keepLastTurns: number): ChatMessage[] {
  const nonSystem = messages.filter((m) => m.role !== "system");
  let lastUserIdx = -1;
  for (let i = nonSystem.length - 1; i >= 0; i--) {
    if (nonSystem[i]!.role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  const lastNTurns = getLastNTurns(messages, keepLastTurns);
  if (lastUserIdx < 0) return lastNTurns;
  const toolAfterLastUser = nonSystem.slice(lastUserIdx + 1).filter((m) => m.role === "tool");
  const lastSet = new Set(lastNTurns);
  const added: ChatMessage[] = [];
  for (const m of toolAfterLastUser) {
    if (!lastSet.has(m)) {
      added.push(m);
      lastSet.add(m);
    }
  }
  return [...lastNTurns, ...added];
}

/**
 * Talk SCC: compile older context into state; keep last N turns verbatim.
 */
export function compileTalkState(input: CompileTalkStateInput): CompileTalkStateOutput {
  const { messages, budgets } = input;
  const keepLastTurns = budgets.keepLastTurns ?? 3;
  const maxStateChars = Math.min(budgets.maxStateChars ?? 4000, 4000);

  const systemMsgs = messages.filter((m) => m.role === "system");
  const firstUser = messages.find((m) => m.role === "user");
  const goal = firstUser?.content?.trim().split(/\n/)[0]?.slice(0, 200) ?? "User conversation.";

  const extracted = extractConstraints(messages);
  const constraintsBlock = buildConstraintsBlock(extracted);

  const olderUser = messages.filter((m) => m.role === "user").slice(1, -keepLastTurns);
  const knownFacts = olderUser
    .map((m) => normalizeBullet((m.content ?? "").replace(/\s+/g, " ").trim()))
    .filter((t) => t.length > 10)
    .slice(0, 8)
    .map((t) => `- ${truncate(t, MAX_BULLET_LEN)}`);

  const assistantMsgs = messages.filter((m) => m.role === "assistant");
  const olderAssistant = assistantMsgs.slice(0, -keepLastTurns);
  const decisions = olderAssistant
    .map((m) => normalizeBullet((m.content ?? "").replace(/\s+/g, " ").trim()))
    .filter((t) => t.length > 10)
    .slice(0, 8)
    .map((t) => `- ${truncate(t, MAX_BULLET_LEN)}`);

  let stateBody = `Goal: ${goal}

Constraints (verbatim):
${constraintsBlock}

Known facts:
${knownFacts.length ? knownFacts.join("\n") : "- (none)"}

Decisions/commitments:
${decisions.length ? decisions.join("\n") : "- (none)"}

Open questions:
- (see recent context below)

Recent context kept verbatim below.`;

  if (stateBody.length > maxStateChars) {
    stateBody = stateBody.slice(0, maxStateChars - 1) + "…";
  }

  const stateContent = `[SPECTYRA_STATE_TALK]
${stateBody}
[/SPECTYRA_STATE_TALK]`;

  const stateMsg: ChatMessage = { role: "system", content: stateContent };
  const kept = getLastNTurns(messages, keepLastTurns);
  const keptMessages = [stateMsg, ...kept];
  const droppedCount = messages.length - keptMessages.length;

  return {
    stateMsg,
    keptMessages,
    droppedCount,
  };
}

/**
 * Code SCC: compile task, rule-like constraints only, single latest failing signal + deduped rest; cap files touched; keep last N turns + all tool outputs after last user turn.
 * SCC output is the ONLY system message added.
 */
export function compileCodeState(input: CompileCodeStateInput): CompileCodeStateOutput {
  const { messages, budgets } = input;
  const keepLastTurns = budgets.keepLastTurns ?? 2;
  const maxStateChars = Math.min(budgets.maxStateChars ?? 4000, 4000);
  const retainToolLogs = budgets.retainToolLogs !== false;

  const firstUser = messages.find((m) => m.role === "user");
  const task = firstUser?.content?.trim().split(/\n/)[0]?.slice(0, 200) ?? "Code task.";

  const extracted = extractConstraints(messages);
  const constraintsBlock = buildConstraintsBlock(extracted);

  const failingSignalsRaw = retainToolLogs ? extractFailingSignals(messages) : [];
  const latestSignal = failingSignalsRaw.length > 0 ? failingSignalsRaw[failingSignalsRaw.length - 1]! : null;
  const restRaw = latestSignal ? failingSignalsRaw.slice(0, -1) : failingSignalsRaw;
  const rest = dedupeFailingSignals(restRaw).slice(0, MAX_FAILING_SIGNALS_AFTER_LATEST);
  const formatSignal = (s: { file?: string; line?: number; code?: string; message?: string; raw?: string }) => {
    if (s.file != null && s.line != null) return `- ${s.file}:${s.line}`;
    if (s.code != null && s.message != null) return `- ${s.code}: ${truncate(s.message, 60)}`;
    return `- ${truncate(s.raw ?? "", 80)}`;
  };
  const latestLine = latestSignal ? formatSignal(latestSignal).replace(/^-\s*/, "") : "";
  const restBlock = rest.map(formatSignal).join("\n");
  const failingBlock =
    latestLine || restBlock
      ? (latestLine ? `Latest: ${latestLine}\nOthers (deduped):\n${restBlock}` : restBlock).trim()
      : "- (none)";

  const touchedFiles = extractTouchedFiles(messages)
    .slice(0, MAX_TOUCHED_FILES)
    .map((p) => normalizePath(p));
  const filesTouched = touchedFiles.length > 0 ? touchedFiles.join(", ") : "(none)";

  let stateBody = `Task: ${task}

Constraints (rule-like only):
${constraintsBlock}

Failing signals:
${failingBlock}

Repo context:
- files touched: ${filesTouched}
- key symbols: (see recent context)

Recent context kept verbatim below.`;

  if (stateBody.length > maxStateChars) {
    stateBody = stateBody.slice(0, maxStateChars - 1) + "…";
  }

  const stateContent = `[SPECTYRA_STATE_CODE]
${stateBody}
[/SPECTYRA_STATE_CODE]`;

  const stateMsg: ChatMessage = { role: "system", content: stateContent };
  const kept = getLastNTurnsPlusToolOutputs(messages, keepLastTurns);
  const keptMessages = [stateMsg, ...kept];
  const droppedCount = messages.length - keptMessages.length;

  return {
    stateMsg,
    keptMessages,
    droppedCount,
  };
}
