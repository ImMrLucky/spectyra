import { describe, expect, it, vi, afterEach } from "vitest";
import { normalizeRuntimeBridgeUrl, runRuntimeVerify } from "./runtimeVerify.js";
import type { AiUsageFinding } from "./types.js";

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : "") },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("normalizeRuntimeBridgeUrl", () => {
  it("appends /__spectyra when omitted", () => {
    expect(normalizeRuntimeBridgeUrl("http://127.0.0.1:8787")).toBe("http://127.0.0.1:8787/__spectyra");
  });
  it("does not duplicate __spectyra", () => {
    expect(normalizeRuntimeBridgeUrl("http://127.0.0.1:8787/__spectyra")).toBe("http://127.0.0.1:8787/__spectyra");
  });
});

describe("runRuntimeVerify", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks possiblyMissed when static scan provider not in events", async () => {
    vi.stubGlobal("fetch", (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/summary") || u.includes("/monitor/summary")) return Promise.resolve(jsonResponse({ requestCount: 2 }));
      if (u.includes("/events")) return Promise.resolve(jsonResponse([{ provider: "anthropic" }]));
      if (u.endsWith("/waste")) return Promise.resolve(jsonResponse({}));
      return Promise.resolve({ ok: false, status: 404, headers: { get: () => "" }, json: async () => ({}), text: async () => "" } as Response);
    });
    const findings = [{ provider: "openai", relativePath: "src/llm.ts" }] as unknown as AiUsageFinding[];
    const r = await runRuntimeVerify(findings, "http://127.0.0.1:1");
    expect(r.reachable).toBe(true);
    expect(r.eventsOk).toBe(true);
    expect(r.possiblyMissed.some((x) => String(x.provider) === "openai")).toBe(true);
  });
});
