/**
 * Proxies OpenAI-style SSE: optional spectyra/* model label rewrite + captures usage
 * from the final chunk when the API includes it (requires stream_options.include_usage).
 */

import { Transform } from "node:stream";

export type OpenAiStreamUsage = {
  prompt_tokens: number;
  completion_tokens: number;
};

function processLine(
  line: string,
  spectyraAlias: string | null,
  onUsage: ((u: OpenAiStreamUsage) => void) | undefined,
): string {
  const noCr = line.replace(/\r$/, "");
  if (!noCr.startsWith("data: ")) return line;
  const rest = noCr.slice(6).trim();
  if (rest === "[DONE]") return noCr;
  try {
    const o = JSON.parse(rest) as Record<string, unknown>;
    const usage = o.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
    if (usage && onUsage && (usage.prompt_tokens != null || usage.completion_tokens != null)) {
      onUsage({
        prompt_tokens: typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : 0,
        completion_tokens: typeof usage.completion_tokens === "number" ? usage.completion_tokens : 0,
      });
    }
    if (spectyraAlias && "model" in o) {
      o.model = spectyraAlias;
    }
    return "data: " + JSON.stringify(o);
  } catch {
    return line;
  }
}

export type OpenAiSseProxyOptions = {
  /** When set, rewrite each chunk's `model` field (e.g. spectyra/smart). */
  spectyraAlias: string | null;
  /** Fired when a chunk includes `usage` (typically the last stream chunk). */
  onUsage?: (u: OpenAiStreamUsage) => void;
};

export function openAiSseProxyTransform(opts: OpenAiSseProxyOptions): Transform {
  const { spectyraAlias, onUsage } = opts;
  let carry = "";
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      try {
        carry += chunk.toString("utf8");
        const parts = carry.split("\n");
        carry = parts.pop() ?? "";
        let out = "";
        for (const line of parts) {
          out += processLine(line, spectyraAlias, onUsage) + "\n";
        }
        cb(null, Buffer.from(out, "utf8"));
      } catch (e) {
        cb(e as Error);
      }
    },
    flush(cb) {
      try {
        if (!carry.length) {
          cb();
          return;
        }
        cb(null, Buffer.from(processLine(carry, spectyraAlias, onUsage) + "\n", "utf8"));
      } catch (e) {
        cb(e as Error);
      }
    },
  });
}
