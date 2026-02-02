/**
 * Turn Generator for Optimizer Lab
 *
 * Algorithmically generates synthetic chat/code message histories with
 * seeded randomness. No LLM calls. Designed to trigger RefPack, PhraseBook, CodeMap.
 */

export type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string };

export interface GeneratorParams {
  turns: number;
  seed: number;
  scenario: string;
  includeSystem: boolean;
  includeTools?: boolean;
}

// --- Seeded PRNG (mulberry32) ---
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed: number) {
  const next = mulberry32(seed);
  return {
    next,
    pickOne<T>(arr: T[]): T {
      return arr[Math.floor(next() * arr.length)]!;
    },
    pickWeighted<T>(choices: [T, number][]): T {
      const total = choices.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [v, w] of choices) {
        r -= w;
        if (r <= 0) return v;
      }
      return choices[choices.length - 1]![0];
    },
    randint(lo: number, hi: number): number {
      return Math.floor(next() * (hi - lo + 1)) + lo;
    },
    chance(p: number): boolean {
      return next() < p;
    },
    shuffle<T>(arr: T[]): T[] {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
}

// --- Chat generator: templates and repetition ---

const CHAT_SCENARIOS = [
  'Customer Support: billing + policy boilerplate',
  'Sales: product requirements + constraints',
  'Internal QA: repeated acceptance criteria',
] as const;

const CODE_SCENARIOS = [
  'Fix failing tests',
  'Refactor types/interfaces',
  'Optimize build / lint errors',
] as const;

const POLICY_BLOCKS = [
  'Before we proceed, please confirm your account email for security. We never ask for passwords via chat.',
  'For security, do not share passwords or full card numbers. Our team will only verify the last 4 digits.',
  'Per our policy, refunds are processed within 5–7 business days. You will receive an email confirmation.',
  'As per company policy, we must verify identity before making account changes. Thank you for your patience.',
];

const USER_INTENTS = [
  { msg: "Hi, I'm having an issue with my billing.", short: true },
  { msg: "I was charged twice this month and need a refund.", short: true },
  { msg: "Can you check my account status? My order ID is {{orderId}}.", short: false },
  { msg: "I need to upgrade my plan. Currently on {{plan}}.", short: false },
  { msg: "There was an outage last night – are there any updates?", short: true },
  { msg: "I need help integrating with our API. We use {{product}}.", short: false },
  { msg: "That's not quite what I meant – I was asking about the refund timeline.", short: true },
  { msg: "Thanks. Can you also confirm the requirements: {{requirements}}?", short: false },
];

const EMPATHY_PREFIXES = [
  "I'm sorry to hear that.",
  "I understand your concern.",
  "Thank you for reaching out.",
  "I'd be happy to help.",
];

const REQUIREMENTS_REPEAT = [
  'Must support SSO, must not store passwords, must be SOC2 compliant.',
  'Requirements: responsive UI, dark mode, and accessibility (WCAG 2.1).',
  'Acceptance criteria: unit tests pass, no new lint errors, coverage ≥ 80%.',
];

export function generateChatMessages(params: GeneratorParams): ChatMessage[] {
  const { turns, seed, scenario, includeSystem } = params;
  const rng = createRng(seed);

  // Fixed entities for repetition
  const customerName = rng.pickOne(['John', 'Sarah', 'Alex', 'Jordan', 'Morgan']);
  const orderId = `ORD-${rng.randint(10000, 99999)}`;
  const productSku = rng.pickOne(['ACME-PRO', 'ACME-BIZ', 'ACME-ENT']);
  const planTier = rng.pickOne(['Starter', 'Business Pro', 'Enterprise']);
  const product = rng.pickOne(['Acme API', 'Acme Dashboard', 'Acme CLI']);

  const slots = { customerName, orderId, productSku, planTier, product };
  const requirements = rng.pickOne(REQUIREMENTS_REPEAT);

  function fill(template: string): string {
    return template
      .replace(/\{\{orderId\}\}/g, orderId)
      .replace(/\{\{plan\}\}/g, planTier)
      .replace(/\{\{product\}\}/g, product)
      .replace(/\{\{customerName\}\}/g, customerName)
      .replace(/\{\{productSku\}\}/g, productSku)
      .replace(/\{\{requirements\}\}/g, requirements);
  }

  const messages: ChatMessage[] = [];

  if (includeSystem) {
    const sys = `You are a helpful support agent for Acme. Be polite and professional. Customer context: ${customerName}, account ref ${orderId}, plan ${planTier}.`;
    messages.push({ role: 'system', content: sys });
  }

  const usedPolicyBlocks: string[] = [];
  let requirementsRepeatCount = 0;

  for (let t = 0; t < turns; t++) {
    // User turn
    const intent = rng.pickOne(USER_INTENTS);
    let userContent = fill(intent.msg);
    // Every 7th user: repeat requirements with minor variation
    if (t > 0 && t % 7 === 0 && requirementsRepeatCount < 3) {
      userContent += '\n\nAlso confirming: ' + requirements;
      requirementsRepeatCount++;
    }
    if (rng.chance(0.1)) userContent += ' Sorry for the typo earlier.';
    messages.push({ role: 'user', content: userContent });

    // Assistant turn: empathy + (optional policy block every 5th) + response
    const empathy = rng.pickOne(EMPATHY_PREFIXES);
    let assistantContent = empathy + ' ';
    if (t % 5 === 4) {
      const policy = rng.pickOne(POLICY_BLOCKS);
      usedPolicyBlocks.push(policy);
      assistantContent += policy + ' ';
    }
    assistantContent += `I've looked up your account (${orderId}). You're on ${planTier}. `;
    assistantContent += rng.pickOne([
      "I'm processing that now and you'll get an email shortly.",
      "Here are the next steps: 1) Confirm your email 2) We'll send a link 3) You're all set.",
      "The refund has been initiated. Expect 5–7 business days.",
      "I've noted your requirements. Our team will follow up within 24 hours.",
    ]);
    if (rng.chance(0.15)) {
      assistantContent += '\n\n' + rng.pickOne(POLICY_BLOCKS);
    }
    messages.push({ role: 'assistant', content: assistantContent });
  }

  return messages;
}

// --- Code generator: repo blobs, tool calls, repetition ---

const CONSTRAINT_PHRASES = [
  'Do not use replaceAll – use replace with global regex.',
  'Target is ES2019; no optional chaining in this file.',
  'Do not add new dependencies without approval.',
  'Must keep the integration to 1–2 lines.',
  'Preserve existing tests; add new ones only for new behavior.',
];

const FILE_PATHS = [
  'apps/web/src/app/app.component.ts',
  'apps/web/src/app/core/api/optimizer-lab.service.ts',
  'packages/sdk/src/client.ts',
  'apps/api/src/routes/optimizerLab.ts',
  'apps/web/src/app/features/optimizer-lab/optimizer-lab.page.ts',
  'packages/sdk/src/types.ts',
  'apps/api/src/types/optimizerLab.ts',
  'tsconfig.json',
  'package.json',
  'apps/web/angular.json',
];

function pseudoFileContent(path: string, rng: ReturnType<typeof createRng>): string {
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
  const lines = [
    `// ${path}`,
    `export interface Config {`,
    `  apiUrl: string;`,
    `  timeout: number;`,
    `}`,
    ``,
    `export function getConfig(): Config {`,
    `  return { apiUrl: '/api', timeout: 5000 };`,
    `}`,
  ];
  return lines.join('\n');
}

function pseudoErrorLog(rng: ReturnType<typeof createRng>): string {
  const file = rng.pickOne(FILE_PATHS);
  const line = rng.randint(1, 80);
  return `ERROR in ${file}:${line}
TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  at getConfig (${file}:${line}:12)
  at main (apps/web/src/main.ts:15:8)`;
}

function pseudoDiff(rng: ReturnType<typeof createRng>): string {
  const path = rng.pickOne(FILE_PATHS);
  return `--- a/${path}
+++ b/${path}
@@ -10,3 +10,3 @@
-  return { apiUrl: '/api', timeout: 5000 };
+  return { apiUrl: environment.apiUrl, timeout: 5000 };
` + ' ';
}

export function generateCodeMessages(params: GeneratorParams): ChatMessage[] {
  const { turns, seed, scenario, includeSystem, includeTools = true } = params;
  const rng = createRng(seed);

  const messages: ChatMessage[] = [];

  if (includeSystem) {
    messages.push({
      role: 'system',
      content: 'You are an expert software engineer. Follow constraints. Use tools when needed. Target ES2019 where specified.',
    });
  }

  const fileBlobs = FILE_PATHS.slice(0, rng.randint(5, 12)).map((path) => ({
    path,
    content: pseudoFileContent(path, rng),
  }));
  const errorLogs: string[] = [];
  for (let i = 0; i < 5; i++) errorLogs.push(pseudoErrorLog(rng));

  let blobIndex = 0;
  let errorLogIndex = 0;

  const userTasks = [
    `Fix the failing tests in the optimizer lab. ${scenario}`,
    `Refactor types in the SDK – avoid \`any\`. ${scenario}`,
    `Resolve build/lint errors. Keep changes minimal. ${scenario}`,
  ];
  const constraints = [...CONSTRAINT_PHRASES];
  rng.shuffle(constraints);

  messages.push({
    role: 'user',
    content: userTasks[0]! + '\n\nConstraints:\n- ' + constraints.slice(0, 3).join('\n- '),
  });

  for (let t = 0; t < turns; t++) {
    const blob = fileBlobs[blobIndex % fileBlobs.length]!;
    blobIndex++;
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
      assistantContent += '\n\nPatch:\n' + pseudoDiff(rng);
    }
    messages.push({ role: 'assistant', content: assistantContent });

    if (includeTools) {
      const toolContent = rng.chance(0.5)
        ? `read_file: path=${blob.path}\n=>\n${blob.content}`
        : `run_terminal_cmd: pnpm lint\n=>\n${errorLogs[errorLogIndex % errorLogs.length]!}`;
      errorLogIndex++;
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

export const CHAT_SCENARIO_OPTIONS = CHAT_SCENARIOS as unknown as string[];
export const CODE_SCENARIO_OPTIONS = CODE_SCENARIOS as unknown as string[];
