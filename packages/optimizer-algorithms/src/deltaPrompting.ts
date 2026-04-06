/**
 * Delta prompting: injects a delta policy system message that instructs the
 * model to answer only the new/changed part of the request.
 */

import type { ChatMsg, PathKind } from "./types.js";

export interface DeltaPromptingInput {
  path: PathKind;
  messages: ChatMsg[];
  enabled: boolean;
  noteUnstableUnitIds?: string[];
}

export interface DeltaPromptingOutput {
  messages: ChatMsg[];
  deltaUsed: boolean;
}

function buildDeltaInstruction(path: PathKind, unstableIds?: string[]): string {
  const unstableLine =
    unstableIds && unstableIds.length
      ? `If anything is unclear or conflicting, ask 1 clarification. Focus on resolving: ${unstableIds
          .slice(0, 6)
          .map(id => `[[REF:${id}]]`)
          .join(", ")}`
      : "If anything is unclear, ask 1 clarification question.";

  if (path === "code") {
    return [
      "Delta policy:",
      "- Output only what changed or what is newly requested.",
      "- Do NOT restate prior explanations; refer to [[REF:*]] if needed.",
      "- Prefer concise output.",
      unstableLine,
    ].join("\n");
  }

  return [
    "Delta policy:",
    "- Answer only the new/changed part of the request (the delta).",
    "- Do NOT restate prior content; refer to [[REF:*]] if needed.",
    "- Keep it concise unless the user explicitly asks for detail.",
    unstableLine,
  ].join("\n");
}

export function applyDeltaPrompting(input: DeltaPromptingInput): DeltaPromptingOutput {
  const { messages, enabled, path, noteUnstableUnitIds } = input;
  if (!enabled) return { messages, deltaUsed: false };

  const instr = buildDeltaInstruction(path, noteUnstableUnitIds);

  const system = messages.filter(m => m.role === "system");
  const nonSystem = messages.filter(m => m.role !== "system");
  const deltaSys: ChatMsg = { role: "system", content: instr };

  const already = system.some(s => s.content.includes("Delta policy:"));
  const newSystem = already ? system : [...system, deltaSys];

  return { messages: [...newSystem, ...nonSystem], deltaUsed: true };
}
