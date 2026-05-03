import { describe, it, expect } from "vitest";
import { mergeProviders, scanTextForProviders } from "./providerScanner.js";

describe("providerScanner", () => {
  it("detects Groq from URL", () => {
    const p = scanTextForProviders(`const u = "https://api.groq.com/openai/v1/chat/completions"`, "f.ts");
    expect(p.some((x) => x.provider === "groq")).toBe(true);
  });

  it("detects GROQ_API_KEY env name", () => {
    const p = scanTextForProviders("if (!process.env.GROQ_API_KEY) throw", "f.ts");
    expect(p.some((x) => x.provider === "groq")).toBe(true);
  });

  it("detects OpenAI-compatible path", () => {
    const p = scanTextForProviders('await fetch(base + "/v1/chat/completions")', "f.ts");
    expect(p.some((x) => x.provider === "unknown-openai-compatible")).toBe(true);
  });

  it("mergeProviders dedupes", () => {
    const a = scanTextForProviders("api.groq.com", "a.ts");
    const b = scanTextForProviders("GROQ_API_KEY", "b.ts");
    const m = mergeProviders([a, b]);
    expect(m.find((x) => x.provider === "groq")).toBeTruthy();
  });
});
