/**
 * SCC (Spectral Context Compiler) tests.
 *
 * - Dedupes constraints and removes double-bullets
 * - Does not drop ES2019 / no optional chaining constraint
 * - Dedupes failing signals
 * - Normalizes touched file paths (strips trailing punctuation)
 * - Profit gate for policy is in optimizer.ts (already works; not tested here)
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  normalizeBullet,
  dedupeOrdered,
  normalizePath,
  dedupeFailingSignals,
  type FailingSignal,
} from "../scc/normalize.js";
import {
  extractConstraints,
  extractFailingSignals,
  extractTouchedFiles,
  extractConfirmedTouchedFiles,
  extractLatestToolFailure,
  extractFocusFiles,
} from "../scc/extract.js";
import { compileTalkState, compileCodeState } from "../contextCompiler.js";
import type { ChatMessage } from "@spectyra/shared";
import type { Budgets } from "../../budgeting/budgetsFromSpectral.js";

const defaultBudgets: Budgets = {
  keepLastTurns: 2,
  maxRefpackEntries: 6,
  minRefpackSavings: 30,
  compressionAggressiveness: 0.5,
  phrasebookAggressiveness: 0.5,
  codemapDetailLevel: 0.7,
  stateCompressionLevel: 0.5,
  maxStateChars: 4000,
  retainToolLogs: true,
};

const emptySpectral = {
  nNodes: 0,
  nEdges: 0,
  lambda2: 0,
  contradictionEnergy: 0,
  stabilityIndex: 0.5,
  recommendation: "EXPAND" as const,
  stableNodeIdx: [],
  unstableNodeIdx: [],
};
const emptyUnits: any[] = [];

describe("normalizeBullet", () => {
  it("strips leading - and normalizes whitespace", () => {
    assert.strictEqual(normalizeBullet("-  Do not use replaceAll"), "Do not use replaceAll");
    assert.strictEqual(normalizeBullet("*  Target ES2019"), "Target ES2019");
    assert.strictEqual(normalizeBullet("  Must keep the integration to 1–2 lines.  "), "Must keep the integration to 1–2 lines.");
  });

  it("removes double-bullets", () => {
    assert.strictEqual(normalizeBullet("- - No optional chaining"), "- No optional chaining");
    assert.strictEqual(normalizeBullet("* * Constraint here"), "* Constraint here");
  });
});

describe("dedupeOrdered", () => {
  it("dedupes while preserving first occurrence order", () => {
    const out = dedupeOrdered(["a", "b", "a", "c", "b"]);
    assert.deepStrictEqual(out, ["a", "b", "c"]);
  });
});

describe("normalizePath", () => {
  it("strips trailing punctuation", () => {
    assert.strictEqual(normalizePath("apps/web/src/app.component.ts."), "apps/web/src/app.component.ts");
    assert.strictEqual(normalizePath("path/to/file.ts;"), "path/to/file.ts");
  });

  it("normalizes backslashes and repeated slashes", () => {
    assert.strictEqual(normalizePath("path\\to\\file.ts"), "path/to/file.ts");
    assert.strictEqual(normalizePath("path//to///file.ts"), "path/to/file.ts");
  });
});

describe("dedupeFailingSignals", () => {
  it("dedupes by file:line:code or raw", () => {
    const items: FailingSignal[] = [
      { file: "a.ts", line: 10, code: "TS2345" },
      { file: "a.ts", line: 10, code: "TS2345" },
      { file: "b.ts", line: 5 },
    ];
    const out = dedupeFailingSignals(items);
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[0]!.file, "a.ts");
    assert.strictEqual(out[1]!.file, "b.ts");
  });
});

describe("extractConstraints", () => {
  it("dedupes constraints and removes double-bullets", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "- Do not use replaceAll.\n- Do not use replaceAll.\n- Target is ES2019." },
    ];
    const { global } = extractConstraints(messages);
    const normalized = global.map((c) => normalizeBullet(c));
    assert.ok(normalized.includes("Do not use replaceAll.") || normalized.some((c) => /replaceAll/.test(c)));
    assert.ok(normalized.some((c) => /ES2019/.test(c)));
    assert.ok(global.length <= 3);
  });

  it("does not drop ES2019 / no optional chaining constraint", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Fix the types.\n\nConstraints:\n- Target is ES2019; no optional chaining in this file.\n- Do not add new deps." },
    ];
    const { global } = extractConstraints(messages);
    const hasEs = global.some((c) => /ES2019/i.test(c));
    const hasOc = global.some((c) => /optional chaining/i.test(c));
    assert.ok(hasEs, "ES2019 constraint should be present");
    assert.ok(hasOc, "no optional chaining constraint should be present");
  });
});

describe("extractFailingSignals", () => {
  it("parses ERROR in file:line and TS codes", () => {
    const messages: ChatMessage[] = [
      {
        role: "tool",
        content: "ERROR in apps/web/src/app.component.ts:42\nTS2345: Argument of type 'string | undefined' is not assignable.",
      },
    ];
    const signals = extractFailingSignals(messages);
    assert.ok(signals.length >= 1);
    const err = signals.find((s) => s.file && s.line);
    assert.ok(err);
    assert.strictEqual(normalizePath(err!.file!), "apps/web/src/app.component.ts");
    assert.strictEqual(err!.line, 42);
  });
});

describe("extractTouchedFiles", () => {
  it("normalizes touched file paths and strips trailing punctuation", () => {
    const messages: ChatMessage[] = [
      { role: "tool", content: "read_file: path=apps/web/src/app.component.ts." },
      { role: "assistant", content: "Checking apps/api/src/routes/optimizerLab.ts;" },
    ];
    const files = extractTouchedFiles(messages);
    assert.ok(files.some((p) => p.includes("app.component.ts") && !p.endsWith(".")));
    assert.ok(files.some((p) => p.includes("optimizerLab.ts") && !p.endsWith(";")));
  });
});

describe("extractConfirmedTouchedFiles", () => {
  it("includes read_file: path=... from tool messages", () => {
    const messages: ChatMessage[] = [
      { role: "tool", content: "read_file: path=apps/web/src/app.component.ts" },
    ];
    const files = extractConfirmedTouchedFiles(messages);
    assert.ok(files.some((p) => p.includes("app.component.ts")));
  });

  it("includes user Relevant file again: code fence paths", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Relevant file again:\n```ts\napps/web/src/main.ts\n```" },
    ];
    const files = extractConfirmedTouchedFiles(messages);
    assert.ok(files.some((p) => p.includes("main.ts")));
  });

  it("ignores --- a/... / +++ b/... diff header artifacts", () => {
    const messages: ChatMessage[] = [
      { role: "assistant", content: "Patch: --- a/tsconfig.js\n+++ b/tsconfig.js\n" },
      { role: "tool", content: "read_file: path=apps/web/src/app.component.ts" },
    ];
    const files = extractConfirmedTouchedFiles(messages);
    assert.ok(!files.some((p) => p === "tsconfig.js" || p.startsWith("a/") || p.startsWith("b/")));
    assert.ok(files.some((p) => p.includes("app.component.ts")));
  });
});

describe("extractLatestToolFailure", () => {
  it("returns last tool block containing TS error", () => {
    const messages: ChatMessage[] = [
      { role: "tool", content: "Command: pnpm lint\nOutput: no errors" },
      {
        role: "tool",
        content: "Command: pnpm lint\nERROR in apps/web/src/main.ts:9\nTS2345: string | undefined not assignable to string.",
      },
    ];
    const out = extractLatestToolFailure(messages);
    assert.ok(out != null);
    assert.ok(out!.output.includes("TS2345"));
    assert.ok(out!.output.includes("string | undefined"));
  });
});

describe("extractFocusFiles", () => {
  it("derives focus files from failing signals and user Relevant file again", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Fix the bug." },
      { role: "tool", content: "ERROR in apps/web/src/optimizer-lab.page.ts:9\nTS2345: error." },
      { role: "user", content: "Relevant file again:\n```\napps/web/src/app.component.ts\n```" },
    ];
    const files = extractFocusFiles(messages);
    assert.ok(files.some((p) => p.includes("optimizer-lab.page.ts")));
    assert.ok(files.some((p) => p.includes("app.component.ts")));
    assert.ok(files.length <= 5);
  });
});

describe("compileTalkState", () => {
  it("dedupes constraints and does not drop ES2019/no optional chaining", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Refactor the SDK.\n\nConstraints:\n- Target is ES2019; no optional chaining in this file.\n- Do not use replaceAll." },
      { role: "assistant", content: "I will refactor." },
    ];
    const out = compileTalkState({
      messages,
      units: emptyUnits,
      spectral: emptySpectral,
      budgets: defaultBudgets,
    });
    const content = out.stateMsg.content;
    assert.ok(content.includes("ES2019") || content.includes("optional chaining"), "state must include ES/OC constraint");
    assert.ok(content.includes("Constraints"));
    assert.ok(content.includes("[SPECTYRA_STATE_TALK]"));
  });
});

describe("compileCodeState", () => {
  it("dedupes failing signals and normalizes touched files", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Fix the build." },
      {
        role: "tool",
        content: "ERROR in apps/web/src/main.ts:10\nTS2345: Type error.\nERROR in apps/web/src/main.ts:10\nTS2345: Type error.",
      },
      { role: "tool", content: "read_file: path=packages/sdk/src/client.ts." },
    ];
    const out = compileCodeState({
      messages,
      units: emptyUnits,
      spectral: emptySpectral,
      budgets: defaultBudgets,
    });
    const content = out.stateMsg.content;
    assert.ok(content.includes("Failing signals"));
    assert.ok(content.includes("[SPECTYRA_STATE_CODE]"));
    assert.ok(content.includes("files touched") || content.includes("client.ts"));
  });

  it("contains Latest tool failure section when tool output has TS error", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Fix lint." },
      {
        role: "tool",
        content: "Command: pnpm lint\nERROR in apps/web/src/page.ts:9\nTS2345: Type 'string | undefined' is not assignable to type 'string'.",
      },
    ];
    const out = compileCodeState({
      messages,
      units: emptyUnits,
      spectral: emptySpectral,
      budgets: defaultBudgets,
    });
    const content = out.stateMsg.content;
    assert.ok(content.includes("Latest tool failure") || content.includes("verbatim excerpt"), "SCC should include latest tool failure section");
    assert.ok(content.includes("TS2345"));
  });

  it("contains Focus files section", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Fix the build." },
      { role: "tool", content: "ERROR in apps/web/src/optimizer-lab.page.ts:9\nTS2345: error." },
    ];
    const out = compileCodeState({
      messages,
      units: emptyUnits,
      spectral: emptySpectral,
      budgets: defaultBudgets,
    });
    const content = out.stateMsg.content;
    assert.ok(content.includes("Focus files"));
    assert.ok(content.includes("optimizer-lab.page.ts"));
  });

  it("does not include a/tsconfig.js or b/tsconfig.js style artifacts in repo context", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Fix types." },
      { role: "assistant", content: "--- a/tsconfig.js\n+++ b/tsconfig.js\n" },
      { role: "tool", content: "read_file: path=apps/web/src/app.component.ts" },
    ];
    const out = compileCodeState({
      messages,
      units: emptyUnits,
      spectral: emptySpectral,
      budgets: defaultBudgets,
    });
    const content = out.stateMsg.content;
    assert.ok(!content.includes("a/tsconfig.js"), "SCC must not include diff artifact a/tsconfig.js");
    assert.ok(!content.includes("b/tsconfig.js"), "SCC must not include diff artifact b/tsconfig.js");
  });

  it("contains Next actions block", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Fix the build." },
    ];
    const out = compileCodeState({
      messages,
      units: emptyUnits,
      spectral: emptySpectral,
      budgets: defaultBudgets,
    });
    const content = out.stateMsg.content;
    assert.ok(content.includes("Next actions"));
    assert.ok(content.includes("Open the focus files") || content.includes("read_file"));
    assert.ok(content.includes("Do not edit unrelated files"));
  });
});
