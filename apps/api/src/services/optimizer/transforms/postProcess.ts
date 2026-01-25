import { PathKind } from "../spectral/types";

export interface PostProcessInput {
  path: PathKind;
  text: string;
  trimLevel: "none" | "moderate" | "aggressive";
}

function stripCommonBoilerplate(s: string): string {
  let t = s;

  // remove "Sure, here's..." openers
  t = t.replace(/^(Sure|Absolutely|Of course|Certainly)[\s,.-]+/i, "");

  // remove trailing "Let me know..." endings (common token waste)
  t = t.replace(/\n?\s*(Let me know|If you have any questions|Hope this helps).*$/is, "");

  return t.trim();
}

function compressLongScaffold(s: string, aggressive: boolean): string {
  let t = s.trim();

  // If overly long step scaffolding, collapse headings
  // Example: "Step 1: ... Step 2: ..." keep but reduce extra prose
  if (/Step\s+\d+/i.test(t) && t.length > (aggressive ? 900 : 1400)) {
    // keep first ~N chars + preserve code blocks if any
    const codeBlocks = t.match(/```[\s\S]*?```/g) ?? [];
    // remove code blocks temporarily
    const tNoCode = t.replace(/```[\s\S]*?```/g, "<<<CODE_BLOCK>>>");
    const cut = aggressive ? 850 : 1200;
    let head = tNoCode.slice(0, cut).trim();
    if (!head.endsWith(".") && !head.endsWith(")") && !head.endsWith(":")) head += "…";

    // put code blocks back (append)
    if (codeBlocks.length) {
      head += "\n\n" + codeBlocks.slice(0, aggressive ? 1 : 2).join("\n\n");
      if (codeBlocks.length > (aggressive ? 1 : 2)) head += "\n\n```...\n(trimmed additional code blocks)\n```";
    }
    return head.trim();
  }

  // For aggressive trimming, collapse excess blank lines
  if (aggressive) t = t.replace(/\n{3,}/g, "\n\n");

  return t;
}

function enforcePatchFormatIfPresent(text: string, aggressive: boolean): string {
  // If there's a diff code fence, keep only diff + a few bullets after it
  const diffMatch = text.match(/```diff[\s\S]*?```/i);
  if (!diffMatch) return text;

  const diffBlock = diffMatch[0];
  const after = text.slice(text.indexOf(diffBlock) + diffBlock.length).trim();

  // Collect first few bullets
  const bullets = after
    .split("\n")
    .filter(l => /^\s*[-*]\s+/.test(l))
    .slice(0, aggressive ? 3 : 5);

  const extra = bullets.length ? "\n\n" + bullets.join("\n") : "";
  return (diffBlock + extra).trim();
}

export function postProcessOutput(input: PostProcessInput): string {
  const { path, trimLevel } = input;
  let t = input.text ?? "";
  if (!t.trim()) return t;

  if (trimLevel === "none") return t.trim();

  const aggressive = trimLevel === "aggressive";

  t = stripCommonBoilerplate(t);

  // path-specific: code should keep code fences; talk can be more compressed
  if (path === "code") {
    t = enforcePatchFormatIfPresent(t, aggressive);
    t = compressLongScaffold(t, aggressive);
  } else {
    t = compressLongScaffold(t, aggressive);
    if (aggressive && t.length > 900) {
      // hard cap for talk outputs
      t = t.slice(0, 900).trim() + "…";
    }
  }

  return t.trim();
}
