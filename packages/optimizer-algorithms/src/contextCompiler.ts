import type { ChatMsg, SemanticUnit, SpectralResult, Budgets } from "./types.js";
import {
  normalizeBullet, dedupeOrdered, dedupeUserSentencesKeepLast,
  normalizePath, dedupeFailingSignals,
} from "./scc/normalize.js";
import {
  extractConstraints, extractFailingSignals, extractConfirmedTouchedFiles,
  extractLatestToolFailure,
} from "./scc/extract.js";

export interface CompileTalkStateInput {
  messages: ChatMsg[];
  units: SemanticUnit[];
  spectral: SpectralResult;
  budgets: Budgets;
}

export interface CompileTalkStateOutput {
  stateMsg: ChatMsg;
  keptMessages: ChatMsg[];
  droppedCount: number;
}

export interface CompileCodeStateInput {
  messages: ChatMsg[];
  units: SemanticUnit[];
  spectral: SpectralResult;
  budgets: Budgets;
}

export interface CompileCodeStateOutput {
  stateMsg: ChatMsg;
  keptMessages: ChatMsg[];
  droppedCount: number;
  failingSignalsCount: number;
}

const MAX_BULLET_LEN = 120;
const MAX_CONSTRAINT_LINE = 200;
const MAX_LATEST_TOOL_EXCERPT_CHARS = 1200;
const MAX_FAILING_SIGNALS_AFTER_LATEST = 6;
const MAX_STACK_LINES_IN_EXCERPT = 3;

const OPERATING_RULES = `Operating rules (must follow):
- If the user asks to run tests/lint: immediately call run_terminal_cmd (do NOT read_file first) and paste the full output. Do not add narration.
- Only propose code patches AFTER you read_file the failing file + line.
- Treat .json as JSON (never assume TS/JS content).`;

const NEXT_ACTIONS = `Next actions:
0) If asked to run tests/lint: run_terminal_cmd now.
1) read_file the focus file at the failing line.
2) identify the exact expression producing the error.
3) apply the smallest fix; rerun lint/tests.`;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trim() + "…";
}

function stripRefPackArtifacts(text: string): string {
  return text.replace(/\[\[R\d+\]\]/g, "").replace(/GLOSSARY[\s\S]*?END_GLOSSARY/g, "");
}

function trimToolExcerptToErrorAndStack(output: string, maxStackLines: number): string {
  const lines = output.split("\n");
  let start = -1;
  let stackCount = 0;
  const stackRe = /^\s*at\s+\S+\s+\([^)]+:\d+:\d+\)/;
  const tsRe = /^\s*TS\d+:/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/ERROR\s+in\s|TS\d+:/i.test(line)) { if (start < 0) start = i; stackCount = 0; }
    if (start >= 0 && stackRe.test(line)) { stackCount++; if (stackCount > maxStackLines) return lines.slice(start, i).join("\n").trim(); }
  }
  if (start >= 0) {
    const slice = lines.slice(start);
    const collected: string[] = [slice[0]!];
    let tsLineIncluded = false;
    let n = 0;
    for (let j = 1; j < slice.length && n < maxStackLines; j++) {
      if (!tsLineIncluded && tsRe.test(slice[j]!)) { collected.push(slice[j]!); tsLineIncluded = true; continue; }
      if (stackRe.test(slice[j]!)) { collected.push(slice[j]!); n++; }
    }
    return collected.join("\n").trim();
  }
  return output.slice(0, MAX_LATEST_TOOL_EXCERPT_CHARS);
}

function buildTs2345Hint(
  latestSignal: { code?: string; message?: string; raw?: string } | null,
  latestToolFailure: { output: string } | null
): string {
  const raw = latestSignal?.raw ?? latestSignal?.message ?? latestToolFailure?.output ?? "";
  const code = latestSignal?.code ?? (raw.match(/TS2345/) ? "TS2345" : null);
  if (code !== "TS2345") return "";
  if (!/string\s*\|\s*undefined|undefined.*string/i.test(raw)) return "";
  return `TS2345 hint: This usually means optional env/config value is flowing into a function expecting string. Look for process.env.X or config lookup returning string | undefined and either provide a fallback, throw early, or narrow type.`;
}

function isTestRequestText(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  return /\brun the full test suite\b/i.test(t) || /\brun tests?\b/i.test(t) || /\brun lint\b/i.test(t) || /\bpnpm\s+test\b/i.test(t) || /\bpnpm\s+lint\b/i.test(t) || /\bpaste (?:the )?output\b/i.test(t);
}

function extractPinnedTaskFromPriorState(messages: ChatMsg[]): string | null {
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || m.role !== "system") continue;
    const c = typeof m.content === "string" ? m.content : "";
    if (c.indexOf("[SPECTYRA_STATE_CODE]") === -1) continue;
    const match = c.match(/^\s*Task:\s*(.+)\s*$/m);
    if (match && match[1]) return match[1].trim().slice(0, 200);
  }
  return null;
}

function buildConstraintsBlock(extracted: ReturnType<typeof extractConstraints>): string {
  const global = dedupeOrdered(extracted.global).slice(0, 20);
  if (global.length === 0) return "- (none)";
  return global.map((c) => `- ${truncate(normalizeBullet(c), MAX_CONSTRAINT_LINE)}`).join("\n");
}

function getLastNTurns(messages: ChatMsg[], n: number): ChatMsg[] {
  const nonSystem = messages.filter((m) => m.role !== "system");
  const turns = Math.min(n, Math.ceil(nonSystem.length / 2));
  const keepCount = Math.min(nonSystem.length, turns * 2);
  return nonSystem.slice(-keepCount);
}

function getLastUserPlusToolOutputs(messages: ChatMsg[]): ChatMsg[] {
  const nonSystem = messages.filter((m) => m.role !== "system");
  let lastUserIdx = -1;
  for (let i = nonSystem.length - 1; i >= 0; i--) {
    if (nonSystem[i]!.role === "user") { lastUserIdx = i; break; }
  }
  if (lastUserIdx < 0) return nonSystem.slice(-2);
  const userMsg = nonSystem[lastUserIdx]!;
  const toolAfter = nonSystem.slice(lastUserIdx + 1).filter((m) => m.role === "tool");
  return [userMsg, ...toolAfter];
}

export function compileTalkState(input: CompileTalkStateInput): CompileTalkStateOutput {
  const { messages, budgets } = input;
  const keepLastTurns = budgets.keepLastTurns ?? 3;
  const maxStateChars = Math.min(budgets.maxStateChars ?? 4000, 4000);
  const firstUser = messages.find((m) => m.role === "user");
  const goal = firstUser?.content?.trim().split(/\n/)[0]?.slice(0, 200) ?? "User conversation.";
  const extracted = extractConstraints(messages);
  const constraintsBlock = buildConstraintsBlock(extracted);
  const olderUser = messages.filter((m) => m.role === "user").slice(1, -keepLastTurns);
  const rawFacts = olderUser.map((m) => normalizeBullet((m.content ?? "").replace(/\s+/g, " ").trim())).filter((t) => t.length > 10);
  const knownFacts = dedupeUserSentencesKeepLast(rawFacts).slice(0, 8).map((t) => `- ${truncate(t, MAX_BULLET_LEN)}`);
  const assistantMsgs = messages.filter((m) => m.role === "assistant");
  const olderAssistant = assistantMsgs.slice(0, -keepLastTurns);
  const rawDecisions = olderAssistant.map((m) => normalizeBullet((m.content ?? "").replace(/\s+/g, " ").trim())).filter((t) => t.length > 10);
  const decisions = dedupeUserSentencesKeepLast(rawDecisions).slice(0, 8).map((t) => `- ${truncate(t, MAX_BULLET_LEN)}`);
  let stateBody = `Goal: ${goal}\n\nConstraints (verbatim):\n${constraintsBlock}\n\nKnown facts:\n${knownFacts.length ? knownFacts.join("\n") : "- (none)"}\n\nDecisions/commitments:\n${decisions.length ? decisions.join("\n") : "- (none)"}\n\nOpen questions:\n- (see recent context below)\n\nRecent context kept verbatim below.`;
  if (stateBody.length > maxStateChars) stateBody = stateBody.slice(0, maxStateChars - 1) + "…";
  const stateContent = `[SPECTYRA_STATE_TALK]\n${stateBody}\n[/SPECTYRA_STATE_TALK]`;
  const stateMsg: ChatMsg = { role: "system", content: stateContent };
  const kept = getLastNTurns(messages, keepLastTurns);
  const keptMessages = [stateMsg, ...kept];
  const droppedCount = messages.length - keptMessages.length;
  return { stateMsg, keptMessages, droppedCount };
}

export function compileCodeState(input: CompileCodeStateInput): CompileCodeStateOutput {
  const { messages, budgets } = input;
  const keepLastTurns = budgets.keepLastTurns ?? 2;
  const maxStateChars = Math.min(budgets.maxStateChars ?? 4000, 4000);
  const retainToolLogs = budgets.retainToolLogs !== false;
  const pinnedTask = extractPinnedTaskFromPriorState(messages);
  let firstUser: ChatMsg | null = null;
  for (const m of messages) { if (m.role === "user") { firstUser = m; break; } }
  let firstUserLine = "";
  if (firstUser) firstUserLine = String(firstUser.content).trim().split(/\n/)[0].slice(0, 200);
  const task = pinnedTask || firstUserLine || "Code task.";
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastUserText = (lastUser?.content ?? "").trim();
  const isTestRequest = isTestRequestText(lastUserText);
  const testOverrideBanner = isTestRequest ? "MANDATORY FIRST ACTION: run_terminal_cmd now (do NOT read_file first).\n" : "";
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
  const latestFailureBlock = (latestLine || restBlock) ? (latestLine ? `Latest: ${latestLine}\nOthers (deduped):\n${restBlock}` : restBlock).trim() : "- (none)";
  const latestToolFailure = retainToolLogs ? extractLatestToolFailure(messages) : null;
  const rawOutput = latestToolFailure != null ? latestToolFailure.output : "";
  const trimmedOutput = rawOutput.length > 0 ? trimToolExcerptToErrorAndStack(rawOutput, MAX_STACK_LINES_IN_EXCERPT) : "";
  const recentToolOutputExcerpt = latestToolFailure != null ? (latestToolFailure.cmd ? `Command: ${latestToolFailure.cmd}\n` : "") + "Output:\n" + (trimmedOutput.length > MAX_LATEST_TOOL_EXCERPT_CHARS ? trimmedOutput.slice(0, MAX_LATEST_TOOL_EXCERPT_CHARS - 1) + "…" : trimmedOutput) : "";
  const focusSet: string[] = [];
  if (latestSignal?.file) focusSet.push(normalizePath(latestSignal.file));
  const stackMatch = trimmedOutput.match(/\bat\s+\S+\s+\(([^)]+):(\d+):\d+\)/);
  if (stackMatch) focusSet.push(normalizePath(stackMatch[1]!));
  const confirmedTouched = extractConfirmedTouchedFiles(messages).map((p) => normalizePath(p));
  for (const p of confirmedTouched) { if (focusSet.length >= 3) break; focusSet.push(p); }
  const focusFiles = dedupeOrdered(focusSet).slice(0, 3);
  const tsHint = buildTs2345Hint(latestSignal, latestToolFailure);
  const stateLines: string[] = [];
  if (testOverrideBanner) stateLines.push(testOverrideBanner.replace(/\n$/, ""));
  stateLines.push(OPERATING_RULES, "", NEXT_ACTIONS, "", `Task: ${task}`, "", "Constraints (rule-like only):", constraintsBlock, "", "Latest failure:", latestFailureBlock, "", "Focus files:", focusFiles.length ? focusFiles.map((p) => `- ${p}`).join("\n") : "- (none)");
  if (recentToolOutputExcerpt) { stateLines.push("", "Recent tool output excerpt:", recentToolOutputExcerpt); }
  if (tsHint) { stateLines.push("", tsHint); }
  let stateBody = stateLines.join("\n");
  stateBody = stripRefPackArtifacts(stateBody);
  if (stateBody.length > maxStateChars) stateBody = stateBody.slice(0, maxStateChars - 1) + "…";
  const stateContent = `[SPECTYRA_STATE_CODE]\n${stateBody}\n[/SPECTYRA_STATE_CODE]`;
  const stateMsg: ChatMsg = { role: "system", content: stateContent };
  const kept = getLastUserPlusToolOutputs(messages);
  const keptMessages = [stateMsg, ...kept];
  const droppedCount = messages.length - keptMessages.length;
  const allSignals = retainToolLogs ? extractFailingSignals(messages) : [];
  const latest = allSignals.length > 0 ? 1 : 0;
  const restCount = allSignals.length > 0 ? dedupeFailingSignals(allSignals.slice(0, -1)).slice(0, MAX_FAILING_SIGNALS_AFTER_LATEST).length : 0;
  const failingSignalsCount = latest + restCount;
  return { stateMsg, keptMessages, droppedCount, failingSignalsCount };
}
