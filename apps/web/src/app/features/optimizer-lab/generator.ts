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

/** Derive a numeric seed from a string so different scenarios produce different RNG sequences. */
function hashScenario(scenario: string): number {
  let h = 0;
  for (let i = 0; i < scenario.length; i++) {
    h = (h << 5) - h + scenario.charCodeAt(i);
    h = h | 0;
  }
  return h >>> 0;
}

/** Combined seed so changing scenario always changes generated content. */
function seedForScenario(seed: number, scenario: string): number {
  return Math.imul(seed, 31) + hashScenario(scenario);
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
  'Onboarding: setup steps and feature walkthroughs',
  'Technical Support: API docs and error messages',
  'Compliance: security and audit trail questions',
  'Renewals: contract terms and pricing tiers',
  'Escalation: handoff and SLA acknowledgments',
  'Feedback: NPS and feature requests',
  'Outage: status updates and ETA boilerplate',
] as const;

const CODE_SCENARIOS = [
  'Fix failing tests',
  'Refactor types/interfaces',
  'Optimize build / lint errors',
  'Add error handling and logging',
  'Migrate deprecated APIs',
  'Document public functions',
  'Reduce bundle size and tree-shake',
  'Fix accessibility (a11y) issues',
  'Add unit tests for edge cases',
  'Resolve dependency conflicts',
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
  const rng = createRng(seedForScenario(seed, scenario));

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
    const sys = `You are a helpful support agent for Acme. Be polite and professional. Scenario: ${scenario}. Customer context: ${customerName}, account ref ${orderId}, plan ${planTier}.`;
    messages.push({ role: 'system', content: sys });
  }

  const usedPolicyBlocks: string[] = [];
  let requirementsRepeatCount = 0;

  // Scenario-specific boilerplate so generated text visibly differs per scenario
  const scenarioIntro: Record<string, string> = {
    'Customer Support': ' [Billing/Support scenario]',
    'Sales': ' [Sales evaluation]',
    'Internal QA': ' [QA/acceptance scenario]',
    'Onboarding': ' [Onboarding – setup and walkthrough]',
    'Technical Support': ' [Technical – API/docs]',
    'Compliance': ' [Compliance and audit]',
    'Renewals': ' [Renewals – contract/pricing]',
    'Escalation': ' [Escalation – handoff/SLA]',
    'Feedback': ' [Feedback – NPS/feature request]',
    'Outage': ' [Outage – status/ETA]',
  };
  const scenarioKey = Object.keys(scenarioIntro).find((k) => scenario.includes(k)) ?? '';

  for (let t = 0; t < turns; t++) {
    const intent = rng.pickOne(USER_INTENTS);
    let userContent = fill(intent.msg);
    if (scenarioKey && t === 0) userContent += scenarioIntro[scenarioKey];
    if (scenario.includes('Sales')) {
      if (t === 0) userContent += '\n\nI am evaluating ' + product + ' for our team.';
      if (t > 0 && t % 5 === 0) userContent += '\n\nWe need: ' + requirements;
    } else if (scenario.includes('Internal QA')) {
      if (t === 0) userContent += '\n\nContext: ' + requirements;
      if (t > 0 && t % 6 === 0) userContent += '\n\nAcceptance criteria: ' + requirements;
    } else if (scenario.includes('Onboarding')) {
      if (t === 0) userContent += '\n\nFirst time here – need setup steps.';
      if (t > 0 && t % 4 === 0) userContent += '\n\nCan you walk me through the next feature?';
    } else if (scenario.includes('Technical Support')) {
      if (t === 0) userContent += '\n\nI checked the API docs – still getting errors.';
      if (t > 0 && t % 5 === 0) userContent += '\n\nError message: ' + requirements;
    } else if (scenario.includes('Compliance')) {
      if (t === 0) userContent += '\n\nWe need to confirm security and audit trail.';
      if (t > 0 && t % 5 === 0) userContent += '\n\nAudit requirement: ' + requirements;
    } else if (scenario.includes('Renewals')) {
      if (t === 0) userContent += '\n\nContract is up for renewal – need pricing tiers.';
      if (t > 0 && t % 5 === 0) userContent += '\n\nTerms: ' + requirements;
    } else if (scenario.includes('Escalation')) {
      if (t === 0) userContent += '\n\nThis needs to be escalated. SLA acknowledgment required.';
      if (t > 0 && t % 4 === 0) userContent += '\n\nConfirm handoff and ETA.';
    } else if (scenario.includes('Feedback')) {
      if (t === 0) userContent += '\n\nSubmitting NPS and feature request.';
      if (t > 0 && t % 5 === 0) userContent += '\n\nAdditional feedback: ' + requirements;
    } else if (scenario.includes('Outage')) {
      if (t === 0) userContent += '\n\nChecking status – are we in an outage?';
      if (t > 0 && t % 4 === 0) userContent += '\n\nNeed ETA and status update.';
    }
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
  const rng = createRng(seedForScenario(seed, scenario));

  const messages: ChatMessage[] = [];

  if (includeSystem) {
    messages.push({
      role: 'system',
      content: `You are an expert software engineer. Scenario: ${scenario}. Follow constraints. Use tools when needed. Target ES2019 where specified.`,
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

  // Scenario-specific task lines so generated code prompts visibly differ
  const scenarioTaskLines: Record<string, string> = {
    'Fix failing tests': 'Fix the failing tests in the optimizer lab.',
    'Refactor types/interfaces': 'Refactor types in the SDK – avoid `any`.',
    'Optimize build / lint errors': 'Resolve build/lint errors. Keep changes minimal.',
    'Add error handling and logging': 'Add error handling and logging around the API client.',
    'Migrate deprecated APIs': 'Migrate usages of deprecated APIs to the new ones.',
    'Document public functions': 'Document all public functions with JSDoc.',
    'Reduce bundle size and tree-shake': 'Reduce bundle size and improve tree-shaking.',
    'Fix accessibility (a11y) issues': 'Fix accessibility (a11y) issues in the form components.',
    'Add unit tests for edge cases': 'Add unit tests for edge cases in the validator.',
    'Resolve dependency conflicts': 'Resolve dependency conflicts in package.json.',
  };
  const codeScenarioKey = Object.keys(scenarioTaskLines).find((k) => scenario.includes(k));
  const taskLine = codeScenarioKey
    ? scenarioTaskLines[codeScenarioKey]! + ` [Scenario: ${scenario}]`
    : `Fix the failing tests. [Scenario: ${scenario}]`;
  const constraints = [...CONSTRAINT_PHRASES];
  rng.shuffle(constraints);

  messages.push({
    role: 'user',
    content: taskLine + '\n\nConstraints:\n- ' + constraints.slice(0, 3).join('\n- '),
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
