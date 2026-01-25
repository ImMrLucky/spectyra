import { PathKind } from "../spectral/types";

export interface PostProcessInput {
  path: PathKind;
  text: string;
  trimLevel: "none" | "moderate" | "aggressive";
  preserveCodeBlocks?: boolean;
}

function stripCommonBoilerplate(s: string): string {
  let t = s;

  // Extended boilerplate patterns
  const boilerplatePatterns = [
    /^(Sure|Absolutely|Of course|Certainly|Definitely|Happy to help)[\s,.-]+/i,
    /\n?\s*(Let me know|If you have any questions|Hope this helps|Feel free to ask|Don't hesitate).*$/is,
    /^Here'?s?\s+(the|your|a)\s+/i, // "Here's the code" -> just show code
    /^I'?(?:ve|ll|d)\s+(created|made|written|prepared)/i,
  ];

  for (const pattern of boilerplatePatterns) {
    t = t.replace(pattern, "");
  }

  return t.trim();
}

// NEW: Extract and preserve code blocks
function extractCodeBlocks(text: string): { blocks: string[]; textWithoutCode: string } {
  const blocks: string[] = [];
  const placeholder = "<<<CODE_BLOCK_PLACEHOLDER>>>";
  
  let textWithoutCode = text;
  const re = /```[\s\S]*?```/g;
  let match;
  
  while ((match = re.exec(text)) !== null) {
    blocks.push(match[0]);
  }
  
  textWithoutCode = text.replace(re, placeholder);
  
  return { blocks, textWithoutCode };
}

function compressLongScaffold(s: string, aggressive: boolean, preserveCode: boolean): string {
  let t = s.trim();

  // Extract code blocks if preserving
  const { blocks, textWithoutCode } = preserveCode 
    ? extractCodeBlocks(t) 
    : { blocks: [], textWithoutCode: t };

  // Work on text without code
  let processed = textWithoutCode;

  // Collapse step scaffolding
  if (/Step\s+\d+/i.test(processed) && processed.length > (aggressive ? 900 : 1400)) {
    const cut = aggressive ? 850 : 1200;
    let head = processed.slice(0, cut).trim();
    if (!head.endsWith(".") && !head.endsWith(")") && !head.endsWith(":")) {
      head += "…";
    }
    processed = head;
  }

  // Aggressive trimming
  if (aggressive) {
    // Collapse excess whitespace
    processed = processed.replace(/\n{3,}/g, "\n\n");
    
    // Remove redundant phrases
    processed = processed.replace(/As (?:I mentioned|mentioned earlier|stated before),?\s*/gi, "");
    processed = processed.replace(/To (?:summarize|recap|reiterate),?\s*/gi, "");
  }

  // Restore code blocks
  if (preserveCode && blocks.length > 0) {
    const maxBlocks = aggressive ? 1 : 2;
    const keptBlocks = blocks.slice(0, maxBlocks);
    
    processed = processed.replace(
      /<<<CODE_BLOCK_PLACEHOLDER>>>/g, 
      () => keptBlocks.shift() || ""
    );
    
    if (blocks.length > maxBlocks) {
      processed += `\n\n// ... (${blocks.length - maxBlocks} more code blocks trimmed)`;
    }
  }

  return processed.trim();
}

function enforcePatchFormatIfPresent(text: string, aggressive: boolean): string {
  const diffMatch = text.match(/```diff[\s\S]*?```/i);
  if (!diffMatch) return text;

  const diffBlock = diffMatch[0];
  const after = text.slice(text.indexOf(diffBlock) + diffBlock.length).trim();

  // Keep essential explanation bullets
  const bullets = after
    .split("\n")
    .filter(l => /^\s*[-*]\s+/.test(l))
    .slice(0, aggressive ? 3 : 5);

  // NEW: Also keep important warnings/notes
  const warnings = after
    .split("\n")
    .filter(l => /(?:warning|note|important|caution):/i.test(l))
    .slice(0, 2);

  const extra = [...bullets, ...warnings].filter((v, i, a) => a.indexOf(v) === i);
  const extraText = extra.length ? "\n\n" + extra.join("\n") : "";
  
  return (diffBlock + extraText).trim();
}

export function postProcessOutput(input: PostProcessInput): string {
  const { path, trimLevel, preserveCodeBlocks = true } = input;
  let t = input.text ?? "";
  if (!t.trim()) return t;

  if (trimLevel === "none") return t.trim();

  const aggressive = trimLevel === "aggressive";

  t = stripCommonBoilerplate(t);

  if (path === "code") {
    t = enforcePatchFormatIfPresent(t, aggressive);
    t = compressLongScaffold(t, aggressive, preserveCodeBlocks);
  } else {
    t = compressLongScaffold(t, aggressive, false);
    
    // Hard cap for talk outputs (but preserve complete sentences)
    if (aggressive && t.length > 900) {
      const sentences = t.split(/[.!?]+\s+/);
      let kept = "";
      for (const sentence of sentences) {
        if ((kept + sentence).length > 900) break;
        kept += sentence + ". ";
      }
      t = kept.trim() || t.slice(0, 900).trim() + "…";
    }
  }

  return t.trim();
}
