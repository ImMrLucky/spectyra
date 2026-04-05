#!/usr/bin/env node
/**
 * One-shot check: send a chat completion with a deliberately repetitive system prompt
 * and print Spectyra's local before/after token estimates from the response.
 *
 * Prerequisites:
 *   - Local Companion running (e.g. spectyra-companion start)
 *   - Provider key configured (SPECTYRA_PROVIDER_KEYS_FILE or env your companion uses)
 *
 * Usage:
 *   node scripts/benchmark-savings.mjs
 *   SPECTYRA_BENCHMARK_URL=http://127.0.0.1:4111 node scripts/benchmark-savings.mjs
 */

const BASE = (process.env.SPECTYRA_BENCHMARK_URL || "http://127.0.0.1:4111").replace(/\/$/, "");

async function main() {
  const h = await fetch(`${BASE}/health`).catch(() => null);
  if (!h?.ok) {
    console.error("Companion not reachable at", BASE);
    console.error("Start it with: spectyra-companion start");
    process.exit(1);
  }
  const health = await h.json();
  if (health.service !== "spectyra-local-companion") {
    console.error("Unexpected /health payload — not Spectyra Local Companion?");
    process.exit(1);
  }
  console.log("Companion run mode:", health.runMode, "| telemetry:", health.telemetryMode);
  if (!health.companionReady) {
    console.warn("companionReady is false — provider key may be missing; request may fail.\n");
  }

  const filler = "Duplicated boilerplate context line for testing token reduction. ";
  const longContext = Array(80).fill(filler).join("");

  const body = {
    model: "spectyra/smart",
    max_tokens: 64,
    temperature: 0,
    messages: [
      { role: "system", content: "You are a concise assistant.\n" + longContext },
      { role: "user", content: "Reply with exactly: OK-SPECTYRA-BENCHMARK" },
    ],
  };

  const r = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await r.text();
  if (!r.ok) {
    console.error("POST /v1/chat/completions failed:", r.status, text.slice(0, 800));
    process.exit(1);
  }

  let j;
  try {
    j = JSON.parse(text);
  } catch {
    console.error("Invalid JSON from companion");
    process.exit(1);
  }

  const sp = j.spectyra;
  if (!sp) {
    console.error("Response missing spectyra metadata.");
    console.log(text.slice(0, 600));
    process.exit(1);
  }

  const before = sp.inputTokensBefore ?? 0;
  const after = sp.inputTokensAfter ?? 0;
  const saved = sp.tokensSaved ?? Math.max(0, before - after);
  const pct = before > 0 ? ((saved / before) * 100).toFixed(1) : "0.0";

  console.log("\n--- Single-request local estimate (not a production average) ---");
  console.log("  Input tokens (pre-optimize estimate): ", before);
  console.log("  Input tokens (post-optimize estimate):", after);
  console.log("  Tokens saved (estimate):              ", saved);
  console.log("  Reduction vs pre-optimize estimate:   ", pct + "%");
  console.log("  Transforms applied:", (sp.transforms || []).join(", ") || "(none)");
  if (j.usage?.prompt_tokens != null) {
    console.log("  Provider billable prompt_tokens:      ", j.usage.prompt_tokens);
  }
  console.log(
    "\nFigures use the companion’s local estimates. Real savings depend on your prompts, model, and license/trial state.",
  );
  console.log("Open http://127.0.0.1:4111/dashboard (or spectyra-companion dashboard) to watch totals while using OpenClaw.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
