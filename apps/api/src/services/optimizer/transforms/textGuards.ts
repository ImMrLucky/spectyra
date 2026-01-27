/**
 * Text Guards
 * 
 * Utilities to protect code fences from transformations.
 * Ensures RefPack, PhraseBook, and other transforms never modify
 * content inside triple-backtick code blocks.
 */

export interface TextSegment {
  type: "code" | "text";
  content: string;
  lang?: string; // Only for type === "code"
}

/**
 * Split text by fenced code blocks, preserving fences in output
 * 
 * Example:
 *   Input: "Hello ```ts\ncode\n``` world"
 *   Output: [
 *     { type: "text", content: "Hello " },
 *     { type: "code", content: "```ts\ncode\n```", lang: "ts" }
 *     { type: "text", content: " world" }
 *   ]
 */
export function splitByFencedCode(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentIndex = 0;
  
  // Match triple backticks with optional language
  // Pattern: ```lang?\ncontent\n```
  const fenceRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  
  while ((match = fenceRegex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;
    
    // Add text segment before this code block
    if (matchStart > currentIndex) {
      const textContent = text.substring(currentIndex, matchStart);
      if (textContent.length > 0) {
        segments.push({
          type: "text",
          content: textContent,
        });
      }
    }
    
    // Add code segment (including the fences)
    segments.push({
      type: "code",
      content: match[0], // Full match including ``` and ```
      lang: match[1] || undefined,
    });
    
    currentIndex = matchEnd;
  }
  
  // Add remaining text after last code block
  if (currentIndex < text.length) {
    const textContent = text.substring(currentIndex);
    if (textContent.length > 0) {
      segments.push({
        type: "text",
        content: textContent,
      });
    }
  }
  
  // If no code blocks found, return single text segment
  if (segments.length === 0) {
    segments.push({
      type: "text",
      content: text,
    });
  }
  
  return segments;
}

/**
 * Apply a replacement function only to text segments (outside code fences)
 * 
 * @param text - Input text that may contain code fences
 * @param replacerFn - Function that takes text content and returns replacement
 * @returns Text with replacements applied only outside code fences
 */
export function replaceOnlyOutsideCodeFences(
  text: string,
  replacerFn: (text: string) => string
): string {
  const segments = splitByFencedCode(text);
  
  const processedSegments = segments.map(segment => {
    if (segment.type === "code") {
      // Preserve code blocks exactly as-is
      return segment.content;
    } else {
      // Apply replacement to text segments
      return replacerFn(segment.content);
    }
  });
  
  return processedSegments.join("");
}

/**
 * Check if a given substring appears inside any code fence
 * 
 * @param text - Full text to search
 * @param substring - Substring to check
 * @returns true if substring appears inside a code fence
 */
export function isInsideCodeFence(text: string, substring: string): boolean {
  const segments = splitByFencedCode(text);
  
  for (const segment of segments) {
    if (segment.type === "code" && segment.content.includes(substring)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract all code block contents (without fences)
 * 
 * @param text - Text containing code fences
 * @returns Array of code block contents
 */
export function extractCodeBlockContents(text: string): Array<{ lang?: string; content: string }> {
  const segments = splitByFencedCode(text);
  const codeBlocks: Array<{ lang?: string; content: string }> = [];
  
  for (const segment of segments) {
    if (segment.type === "code") {
      // Remove fences: ```lang\ncontent\n``` -> content
      const fenceMatch = segment.content.match(/```(\w+)?\n([\s\S]*?)```/);
      if (fenceMatch) {
        codeBlocks.push({
          lang: segment.lang,
          content: fenceMatch[2].trim(),
        });
      }
    }
  }
  
  return codeBlocks;
}
