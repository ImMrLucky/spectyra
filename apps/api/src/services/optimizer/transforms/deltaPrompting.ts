import { PathKind } from "../spectral/types";
import { ChatMessage } from "../unitize";

export interface DeltaPromptingInput {
  path: PathKind;
  messages: ChatMessage[];
  enabled: boolean;
  noteUnstableUnitIds?: string[];
}

export interface DeltaPromptingOutput {
  messages: ChatMessage[];
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
      unstableLine
    ].join("\n");
  }

  return [
    "Delta policy:",
    "- Answer only the new/changed part of the request (the delta).",
    "- Do NOT restate prior content; refer to [[REF:*]] if needed.",
    "- Keep it concise unless the user explicitly asks for detail.",
    unstableLine
  ].join("\n");
}

export function applyDeltaPrompting(input: DeltaPromptingInput): DeltaPromptingOutput {
  const { messages, enabled, path, noteUnstableUnitIds } = input;
  if (!enabled) return { messages, deltaUsed: false };

  const instr = buildDeltaInstruction(path, noteUnstableUnitIds);

  // Insert as a system message near the top, after any existing system memory/glossary.
  const system = messages.filter(m => m.role === "system");
  const nonSystem = messages.filter(m => m.role !== "system");

  const deltaSys: ChatMessage = { role: "system", content: instr };

  // If there is already a delta policy, avoid duplicates (simple check)
  const already = system.some(s => s.content.includes("Delta policy:"));
  const newSystem = already ? system : [...system, deltaSys];

  return { messages: [...newSystem, ...nonSystem], deltaUsed: true };
}
