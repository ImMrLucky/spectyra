import { ChatMessage } from "../unitize";

export interface PatchModeInput {
  messages: ChatMessage[];
  enabled: boolean;
}

export interface PatchModeOutput {
  messages: ChatMessage[];
}

export function applyPatchMode(input: PatchModeInput): PatchModeOutput {
  const { messages, enabled } = input;
  if (!enabled) return { messages };

  const instr: ChatMessage = {
    role: "system",
    content: [
      "Patch mode:",
      "- Output a minimal unified diff (```diff ... ```).",
      "- Then provide at most 3 bullet points explaining the change.",
      "- Do NOT restate the full file or long explanations.",
      "- If missing info blocks a correct patch, ask 1 clarification instead of guessing."
    ].join("\n")
  };

  const system = messages.filter(m => m.role === "system");
  const nonSystem = messages.filter(m => m.role !== "system");

  // avoid duplicates
  const already = system.some(s => s.content.includes("Patch mode:"));
  const newSystem = already ? system : [...system, instr];

  return { messages: [...newSystem, ...nonSystem] };
}
