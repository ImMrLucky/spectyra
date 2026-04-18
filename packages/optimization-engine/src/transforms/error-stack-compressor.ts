import type {
  CanonicalRequest,
  OptimizationTransform,
  TransformContext,
  TransformResult,
  FeatureDetectionResult,
} from "@spectyra/canonical-model";

function isStackFrameLine(line: string): boolean {
  let j = 0;
  while (j < line.length && (line[j] === " " || line[j] === "\t")) j++;
  return j + 3 < line.length && line.startsWith("at ", j);
}

function compressStackTrace(text: string): { result: string; saved: number } {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  let totalSaved = 0;

  while (i < lines.length) {
    if (isStackFrameLine(lines[i])) {
      const frames: string[] = [];
      while (i < lines.length && isStackFrameLine(lines[i])) {
        frames.push(lines[i]);
        i++;
      }
      if (frames.length > 4) {
        out.push(frames[0]);
        out.push(frames[1]);
        out.push(`    ... ${frames.length - 3} more frames omitted ...`);
        out.push(frames[frames.length - 1]);
        const originalLen = frames.join("\n").length;
        const compressedLen = [frames[0], frames[1], `    ... ${frames.length - 3} more frames omitted ...`, frames[frames.length - 1]].join("\n").length;
        totalSaved += originalLen - compressedLen;
      } else {
        out.push(...frames);
      }
    } else {
      out.push(lines[i]);
      i++;
    }
  }

  return { result: out.join("\n"), saved: totalSaved };
}

export const errorStackCompressor: OptimizationTransform = {
  id: "error_stack_compressor",

  applies(_features: FeatureDetectionResult[], request: CanonicalRequest): boolean {
    return request.messages.some((m) => {
      if ((m.role !== "tool" && m.role !== "assistant") || m.text == null || m.text.length <= 500) {
        return false;
      }
      for (const line of m.text.split("\n")) {
        let j = 0;
        while (j < line.length && (line[j] === " " || line[j] === "\t")) j++;
        if (j < line.length && line.startsWith("at ", j)) return true;
      }
      return false;
    });
  },

  run(request: CanonicalRequest, _ctx: TransformContext): TransformResult {
    let totalSaved = 0;
    const messages = request.messages.map(m => {
      if (!m.text || m.text.length < 300) return m;
      if (m.role === "system" || m.role === "user") return m;
      const { result, saved } = compressStackTrace(m.text);
      totalSaved += saved;
      return saved > 0 ? { ...m, text: result } : m;
    });

    if (totalSaved <= 30) {
      return { request, applied: false, notes: ["no significant stack traces to compress"], riskLevel: "low" };
    }

    return {
      request: { ...request, messages },
      applied: true,
      notes: [`compressed stack traces: ${totalSaved} chars saved`],
      estimatedTokenDelta: -Math.ceil(totalSaved / 4),
      riskLevel: "low",
    };
  },
};
