import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  beforeMessageSend,
  buildSecurityScanEventPayload,
  CompanionClient,
  extractPromptText,
  formatSecurityNoticeMarkdown,
  resolveSavingsBadgeView,
  runBeforeMessageSendHook,
  scanPrompt,
  scanPromptSecurity,
  SECURITY_ALERT_ALLOWED_ACTION_LABELS,
  SECURITY_NOTICE_FORBIDDEN_BUTTON_SUBSTRINGS,
} from "@spectyra/openclaw-plugin";
import { evaluateToolCall } from "../../packages/openclaw-plugin/src/hooks/tool-hooks.js";
import { redactText } from "../../packages/openclaw-plugin/src/utils/redact.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginSrcRoot = join(__dirname, "../../packages/openclaw-plugin/src");

async function main(): Promise<void> {
  await (async () => {
    const r = scanPrompt("here is sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH", {});
    assert.ok(r.findings.some((f) => f.category === "api_key"));
    console.log("ok: scanner detects OpenAI-style API keys");
  })();

  await (async () => {
    const r = scanPrompt("key AKIA1234567890123456", {});
    assert.ok(r.findings.some((f) => f.category === "cloud_secret"));
    console.log("ok: scanner detects AWS keys");
  })();

  await (async () => {
    const pem = "-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----";
    const r = scanPrompt(pem, {});
    assert.ok(r.findings.some((f) => f.category === "private_key"));
    console.log("ok: scanner detects private key blocks");
  })();

  await (async () => {
    const t = "x sk-12345678901234567890123456789012 y";
    const out = redactText(t);
    assert.ok(!out.includes("sk-12345678901234567890123456789012"));
    assert.ok(out.includes("[REDACTED]"));
    console.log("ok: scanner redacts secrets");
  })();

  await (async () => {
    const secret = "sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH";
    const r = scanPrompt(`use ${secret} please`, {});
    const f = r.findings[0];
    assert.ok(f);
    assert.ok(!String(f.matchPreview ?? "").includes("sk-proj"));
    console.log("ok: scanner does not return raw secret in finding preview");
  })();

  await (async () => {
    const r = scanPrompt("token sk-12345678901234567890123456789012", {});
    assert.equal(r.advisoryOnly, true);
    const ev = buildSecurityScanEventPayload({
      messageId: "m1",
      flowId: "f1",
      result: r,
    });
    const s = JSON.stringify(ev);
    assert.ok(!s.includes("sk-12345678901234567890123456789012"));
    assert.ok(s.includes("categories"));
    assert.equal((ev as { advisoryOnly?: boolean }).advisoryOnly, true);
    console.log("ok: security scan advisoryOnly + event excludes raw prompt");
  })();

  await (async () => {
    const c = new CompanionClient("http://127.0.0.1:1");
    const h = await c.pingHealth();
    assert.equal(h, null);
    const s = await c.connectionState();
    assert.equal(s.reachable, false);
    console.log("ok: companion client handles connection refused");
  })();

  await (async () => {
    const prev = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/openclaw/v1/traces/")) {
        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    };
    try {
      const c = new CompanionClient("http://127.0.0.1:9");
      const row = await c.getTrace("abc123");
      assert.equal(row, null);
    } finally {
      globalThis.fetch = prev;
    }
    console.log("ok: companion client handles 404 trace");
  })();

  await (async () => {
    const prev = globalThis.fetch;
    globalThis.fetch = async () => new Response("{}", { status: 404 });
    try {
      const c = new CompanionClient("http://127.0.0.1:9");
      const v = await resolveSavingsBadgeView(c, { metadata: {} });
      assert.equal(v, null);
    } finally {
      globalThis.fetch = prev;
    }
    console.log("ok: savings badge does not render without trace data");
  })();

  await (async () => {
    const ctx = { text: "secret", message: { text: "unchanged" } } as Record<string, unknown>;
    const ref = ctx;
    const out = runBeforeMessageSendHook(ctx, {
      companion: new CompanionClient("http://127.0.0.1:1"),
      securityWarningsEnabled: () => false,
    });
    assert.strictEqual(out, ref);
    assert.strictEqual((ctx.message as { text: string }).text, "unchanged");
    const secret = `sk-proj-${"a".repeat(48)}`;
    const ctx2: Record<string, unknown> = { text: secret, messageId: "m1" };
    const ref2 = ctx2;
    runBeforeMessageSendHook(ctx2, {
      companion: new CompanionClient("http://127.0.0.1:1"),
      securityWarningsEnabled: () => true,
      showNonBlockingNotice: () => undefined,
    });
    assert.strictEqual(ref2, ctx2);
    assert.strictEqual(ctx2.text, secret);
    console.log("ok: beforeMessageSend hook returns ctx and does not mutate prompt text");
  })();

  await (async () => {
    const r = scanPrompt("-----BEGIN PRIVATE KEY-----\nX\n-----END PRIVATE KEY-----", {});
    const md = formatSecurityNoticeMarkdown(r);
    for (const bad of SECURITY_NOTICE_FORBIDDEN_BUTTON_SUBSTRINGS) {
      assert.ok(!md.includes(bad), `forbidden label ${bad}`);
    }
    assert.ok(r.level === "critical");
    console.log("ok: critical finding does not imply blocking UI copy");
  })();

  await (async () => {
    const desc = evaluateToolCall("run_terminal_cmd", "{}");
    assert.ok(desc);
    const md = desc.markdown;
    for (const bad of SECURITY_NOTICE_FORBIDDEN_BUTTON_SUBSTRINGS) {
      assert.ok(!md.includes(bad));
    }
    console.log("ok: tool risk warning markdown has no blocking buttons");
  })();

  await (async () => {
    const r = scanPrompt("sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH", {});
    const md = formatSecurityNoticeMarkdown(r);
    for (const label of SECURITY_ALERT_ALLOWED_ACTION_LABELS) {
      assert.ok(md.includes(label), `expected allowed action mention: ${label}`);
    }
    console.log("ok: security alert surfaces Copy Redacted Preview / tips / dismiss");
  })();

  await (async () => {
    const noop = new CompanionClient("http://127.0.0.1:1");
    beforeMessageSend(
      { text: "x" },
      { companion: noop, securityWarningsEnabled: () => true, showNonBlockingNotice: () => undefined },
    );
    console.log("ok: beforeMessageSend short text returns without throw");
  })();

  await (async () => {
    const pkgSrc = pluginSrcRoot;
    const banned = [
      /child_process/,
      /(?<!\.)exec\s*\(/,
      /(?<!\.)spawn\s*\(/,
      /fs\.readFile/,
      /fs\.writeFile/,
      /from\s+["']fs["']/,
      /from\s+["']node:fs["']/,
      /process\.env\.OPENAI/,
      /process\.env\.ANTHROPIC/,
      /process\.env\.AWS/,
      /https:\/\/api\.spectyra/,
    ];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "__tests__") {
          continue;
        }
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          walk(p);
        } else if (p.endsWith(".ts")) {
          files.push(p);
        }
      }
    };
    walk(pkgSrc);
    for (const file of files) {
      const rel = relative(pkgSrc, file);
      const txt = readFileSync(file, "utf8");
      for (const re of banned) {
        assert.ok(!re.test(txt), `Forbidden pattern ${re} in ${rel}`);
      }
    }
    console.log("ok: forbidden imports are not used in production src");
  })();

  await (async () => {
    assert.equal(extractPromptText({ text: "hello" }), "hello");
    assert.equal(extractPromptText({ message: { text: "nested" } }), "nested");
    console.log("ok: extractPromptText reads flat and nested shapes");
  })();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
