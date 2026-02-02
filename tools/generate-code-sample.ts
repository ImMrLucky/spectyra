#!/usr/bin/env node
/**
 * Generate a sample code prompt with N turns for use in Optimizer Lab or other tools.
 * Usage: pnpm exec tsx tools/generate-code-sample.ts [turns] [seed]
 * Default: 50 turns, seed 42. Writes JSON to stdout or --out FILE.
 */

type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string };

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FILE_PATHS = [
  'apps/web/src/app/app.component.ts',
  'apps/web/src/app/core/api/optimizer-lab.service.ts',
  'packages/sdk/src/client.ts',
  'apps/api/src/routes/optimizerLab.ts',
  'apps/web/src/app/features/optimizer-lab/optimizer-lab.page.ts',
  'packages/sdk/src/types.ts',
  'tsconfig.json',
  'package.json',
];

const CONSTRAINT_PHRASES = [
  'Do not use replaceAll – use replace with global regex.',
  'Target is ES2019; no optional chaining in this file.',
  'Do not add new dependencies without approval.',
  'Must keep the integration to 1–2 lines.',
  'Preserve existing tests; add new ones only for new behavior.',
];

function pseudoFileContent(path: string): string {
  if (path.endsWith('package.json')) {
    return `{
  "name": "spectyra-web",
  "version": "1.0.0",
  "scripts": { "build": "ng build", "lint": "ng lint", "test": "ng test" },
  "dependencies": { "@angular/core": "~17.0.0", "rxjs": "~7.8.0" }
}`;
  }
  if (path.endsWith('tsconfig.json')) {
    return `{
  "compilerOptions": { "strict": true, "target": "ES2020", "module": "ESNext" },
  "include": ["src/**/*"]
}`;
  }
  return `// ${path}
export interface Config {
  apiUrl: string;
  timeout: number;
}

export function getConfig(): Config {
  return { apiUrl: '/api', timeout: 5000 };
}
`;
}

function pseudoErrorLog(path: string, line: number): string {
  return `ERROR in ${path}:${line}
TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  at getConfig (${path}:${line}:12)
  at main (apps/web/src/main.ts:15:8)`;
}

function pseudoDiff(path: string): string {
  return `--- a/${path}
+++ b/${path}
@@ -10,3 +10,3 @@
-  return { apiUrl: '/api', timeout: 5000 };
+  return { apiUrl: environment.apiUrl, timeout: 5000 };
`;
}

function generateCodeMessages(turns: number, seed: number, includeSystem: boolean, includeTools: boolean): ChatMessage[] {
  const next = mulberry32(seed);
  const rng = {
    pickOne: <T>(arr: T[]): T => arr[Math.floor(next() * arr.length)]!,
    randint: (lo: number, hi: number) => Math.floor(next() * (hi - lo + 1)) + lo,
    chance: (p: number) => next() < p,
  };

  const messages: ChatMessage[] = [];

  if (includeSystem) {
    messages.push({
      role: 'system',
      content: 'You are an expert software engineer. Follow constraints. Use tools when needed. Target ES2019 where specified.',
    });
  }

  const numBlobs = Math.min(8, FILE_PATHS.length);
  const fileBlobs = FILE_PATHS.slice(0, numBlobs).map((path) => ({ path, content: pseudoFileContent(path) }));
  const errorLogs = fileBlobs.slice(0, 5).map((b, i) => pseudoErrorLog(b.path, 10 + i * 5));

  const constraints = CONSTRAINT_PHRASES.slice(0, 3).join('\n- ');
  messages.push({
    role: 'user',
    content: `Fix the failing tests in the optimizer lab. Refactor types in the SDK – avoid \`any\`.\n\nConstraints:\n- ${constraints}`,
  });

  for (let t = 0; t < turns; t++) {
    const blob = fileBlobs[t % fileBlobs.length]!;
    const includeBlob = rng.chance(0.65);
    let assistantContent = t === 0 ? "I'll check the codebase and run the linter. " : '';
    assistantContent += `Checking ${blob.path}.\n\n`;
    if (includeBlob) {
      assistantContent += '```\n' + blob.content + '\n```\n\n';
    }
    assistantContent += rng.pickOne([
      'I see the issue – the type here is too loose.',
      'The linter is complaining about this block. Fixing it.',
      'Adding proper types and running tests.',
    ]);
    if (t % 3 === 2) {
      assistantContent += '\n\n' + rng.pickOne(CONSTRAINT_PHRASES);
    }
    if (t === turns - 1 && rng.chance(0.5)) {
      assistantContent += '\n\nPatch:\n' + pseudoDiff(blob.path);
    }
    messages.push({ role: 'assistant', content: assistantContent });

    if (includeTools) {
      const toolContent = rng.chance(0.5)
        ? `read_file: path=${blob.path}\n=>\n${blob.content}`
        : `run_terminal_cmd: pnpm lint\n=>\n${errorLogs[t % errorLogs.length]!}`;
      messages.push({ role: 'tool', content: toolContent });
    }

    if (t < turns - 1) {
      let userContent = rng.pickOne([
        'The test still fails. Can you try without adding new deps?',
        'Add the same constraint for the other file: do not use replaceAll.',
        'Run the full test suite and paste the output.',
      ]);
      if (t % 4 === 3) {
        userContent += '\n\nRelevant file again:\n' + blob.path + '\n```\n' + blob.content.slice(0, 300) + '...';
      }
      if (rng.chance(0.35)) {
        userContent += '\n\n' + rng.pickOne(CONSTRAINT_PHRASES);
      }
      messages.push({ role: 'user', content: userContent });
    }
  }

  return messages;
}

// --- CLI ---
const args = process.argv.slice(2);
const turns = parseInt(args[0] || '50', 10) || 50;
const seed = parseInt(args[1] || '42', 10) || 42;
const outIdx = args.indexOf('--out');
const outFile = outIdx >= 0 ? args[outIdx + 1] : null;

const messages = generateCodeMessages(turns, seed, true, true);
const payload = { demoType: 'code' as const, messages };

if (outFile) {
  const fs = require('fs');
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');
  console.error(`Wrote ${messages.length} messages (${turns} turns) to ${outFile}`);
} else {
  console.log(JSON.stringify(payload, null, 2));
}
