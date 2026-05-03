import { describe, it, expect } from "vitest";
import { redactSnippet } from "../utils/redact.js";

describe("redactSnippet", () => {
  it("redacts bearer", () => {
    expect(redactSnippet('Authorization: Bearer secret-token-here')).toContain("[REDACTED]");
  });

  it("redacts sk- keys", () => {
    expect(redactSnippet("key sk-1234567890123456789012345678 end")).toContain("[REDACTED]");
  });
});
