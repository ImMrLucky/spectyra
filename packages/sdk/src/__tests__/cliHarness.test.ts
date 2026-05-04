import assert from "node:assert/strict";
import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildArgs, createCliHarness, createClaudeCliHarness, createCodexCliHarness, createGeminiCliHarness } from "../cli/index.js";

assert.deepEqual(buildArgs([], [], "hello"), ["-p", "hello"]);
assert.deepEqual(buildArgs(["--print"], [], "hello"), ["--print", "hello"]);
assert.deepEqual(buildArgs(["--model", "x"], ["--prompt"], "hello"), ["--model", "x", "--prompt", "hello"]);

const dir = join(tmpdir(), `spectyra-cli-harness-${Date.now()}`);
mkdirSync(dir, { recursive: true });
const script = join(dir, "echo-cli.mjs");
writeFileSync(
  script,
  `process.stdout.write("cwd=" + process.cwd() + "\\n");
process.stdout.write("env=" + process.env.SPECTYRA_TEST_VALUE + "\\n");
process.stdout.write("args=" + process.argv.slice(2).join("|") + "\\n");
process.stderr.write("warn\\n");
process.stdin.on("data", (chunk) => process.stdout.write("stdin=" + chunk.toString()));
`,
  "utf8",
);

try {
  let stdoutChunks = 0;
  let stderrChunks = 0;
  const harness = createCliHarness({
    command: process.execPath,
    defaultArgs: [script],
    provider: "unknown",
    framework: "custom-ai-cli-harness",
    runMode: "off",
    throwOnNonZeroExit: true,
  });
  const result = await harness.run({
    prompt: "hello",
    cwd: dir,
    env: { SPECTYRA_TEST_VALUE: "ok" },
    onStdout: () => stdoutChunks++,
    onStderr: () => stderrChunks++,
  });

  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout.includes(`cwd=${realpathSync(dir)}`));
  assert.ok(result.stdout.includes("env=ok"));
  assert.ok(result.stdout.includes("args=-p|hello"));
  assert.ok(result.stderr.includes("warn"));
  assert.ok(stdoutChunks > 0);
  assert.ok(stderrChunks > 0);
  assert.ok(result.durationMs >= 0);
  assert.equal(result.estimatedInputChars, 5);
  assert.ok(result.estimatedOutputChars > 0);

  const stdinResult = await harness.run({ stdin: "from stdin" });
  assert.ok(stdinResult.stdout.includes("stdin=from stdin"));

  const noThrow = createCliHarness({ command: process.execPath, defaultArgs: ["-e", "process.exit(7)"], runMode: "off", throwOnNonZeroExit: false });
  assert.equal((await noThrow.run({})).exitCode, 7);

  const throws = createCliHarness({ command: process.execPath, defaultArgs: ["-e", "process.stderr.write('bad'); process.exit(2)"], runMode: "off" });
  await assert.rejects(() => throws.run({}), /exited with code 2: bad/);

  assert.ok(createClaudeCliHarness({ command: process.execPath }));
  assert.ok(createGeminiCliHarness({ command: process.execPath }));
  assert.ok(createCodexCliHarness({ command: process.execPath }));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
