import { describe, expect, it } from "vitest";
import { classifyModelHint, extractModelLiteralsFromText } from "./modelClassifier.js";

describe("modelClassifier", () => {
  it("classifies expensive chat models", () => {
    const c = classifyModelHint("gpt-4o");
    expect(c.costProfile).toBe("high");
    expect(c.capability).toBe("chat");
  });

  it("extracts model literals", () => {
    const src = `const x = { model: "gpt-4o-mini", modelName: "claude-3-5-sonnet-latest" };`;
    const m = extractModelLiteralsFromText(src);
    expect(m).toContain("gpt-4o-mini");
    expect(m).toContain("claude-3-5-sonnet-latest");
  });
});
