/**
 * Spectral Context Compiler (SCC) — PG-SCC
 *
 * Produces a single compact "state message" and drops most of the old history.
 * Talk: [SPECTYRA_STATE_TALK] ... [/SPECTYRA_STATE_TALK]
 * Code: [SPECTYRA_STATE_CODE] ... [/SPECTYRA_STATE_CODE]
 */

import type { ChatMessage } from "@spectyra/shared";
import type { PathKind, SemanticUnit, SpectralResult } from "../spectral/types";
import type { Budgets } from "../budgeting/budgetsFromSpectral";

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

const CONSTRAINT_PATTERN = /\b(must|never|always|constraint|do not|don't)\b/i;
const MAX_BULLET_LEN = 120;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trim() + "…";
}

function extractConstraints(messages: ChatMessage[]): string[] {
  const lines: string[] = [];
  for (const msg of messages) {
    const content = (msg.content ?? "").trim();
    if (!content) continue;
    for (const line of content.split(/\n/)) {
      const t = line.trim();
      if (CONSTRAINT_PATTERN.test(t) && t.length < 300) {
        lines.push(t);
      }
    }
  }
  return [...new Set(lines)].slice(0, 15);
}

function getLastNTurns(messages: ChatMessage[], n: number): ChatMessage[] {
  const nonSystem = messages.filter((m) => m.role !== "system");
  const turns = Math.min(n, Math.ceil(nonSystem.length / 2));
  const keepCount = Math.min(nonSystem.length, turns * 2);
  return nonSystem.slice(-keepCount);
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

  const constraints = extractConstraints(messages);
  const constraintsBlock =
    constraints.length > 0 ? constraints.map((c) => `- ${truncate(c, 200)}`).join("\n") : "- (none)";

  const olderUser = messages.filter((m) => m.role === "user").slice(1, -keepLastTurns);
  const knownFacts = olderUser
    .map((m) => (m.content ?? "").replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 10)
    .slice(0, 8)
    .map((t) => `- ${truncate(t, MAX_BULLET_LEN)}`);

  const assistantMsgs = messages.filter((m) => m.role === "assistant");
  const olderAssistant = assistantMsgs.slice(0, -keepLastTurns);
  const decisions = olderAssistant
    .map((m) => (m.content ?? "").replace(/\s+/g, " ").trim())
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
 * Code SCC: compile task, constraints, failing signals, repo context; keep last N turns verbatim.
 */
export function compileCodeState(input: CompileCodeStateInput): CompileCodeStateOutput {
  const { messages, budgets } = input;
  const keepLastTurns = budgets.keepLastTurns ?? 2;
  const maxStateChars = Math.min(budgets.maxStateChars ?? 4000, 4000);
  const retainToolLogs = budgets.retainToolLogs !== false;

  const firstUser = messages.find((m) => m.role === "user");
  const task = firstUser?.content?.trim().split(/\n/)[0]?.slice(0, 200) ?? "Code task.";

  const constraints = extractConstraints(messages);
  const constraintsBlock =
    constraints.length > 0 ? constraints.map((c) => `- ${truncate(c, 200)}`).join("\n") : "- (none)";

  const toolMsgs = messages.filter((m) => m.role === "tool");
  const failingSignals: string[] = [];
  if (retainToolLogs) {
    for (const m of toolMsgs.slice(-10)) {
      const content = (m.content ?? "").trim();
      const errMatch = content.match(/ERROR[^\n]*|TS\d+:[^\n]*|at\s+\S+\s+\([^)]+\)/g);
      if (errMatch) {
        failingSignals.push(...errMatch.slice(0, 2).map((s) => truncate(s, 100)));
      }
    }
  }
  const failingBlock =
    failingSignals.length > 0
      ? failingSignals.slice(0, 8).map((s) => `- ${s}`).join("\n")
      : "- (none)";

  const fileMatches = messages.flatMap((m) =>
    (m.content ?? "").match(/(?:[\w-]+\.(?:ts|js|json|html|css|tsx|jsx)|[\w-]+\/[\w./-]+)/g) ?? []
  );
  const filesTouched = [...new Set(fileMatches)].slice(0, 12).join(", ") || "(none)";

  let stateBody = `Task: ${task}

Constraints (verbatim):
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
  const kept = getLastNTurns(messages, keepLastTurns);
  const droppedCount = messages.length - (1 + kept.length);

  return {
    stateMsg,
    keptMessages: [stateMsg, ...kept],
    droppedCount,
  };
}
