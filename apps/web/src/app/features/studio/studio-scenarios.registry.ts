export type StudioScenarioId =
  | 'token_chat'
  | 'token_code'
  | 'agent_claude'
  | 'langchain_rag'
  | 'multi_agent_loop'
  | 'chatbot_governance'
  | 'supportbot'
  | 'coding_compliance';

export interface StudioScenarioDef {
  id: StudioScenarioId;
  title: string;
  description: string;
  inputSchema: {
    primaryLabel: string;
    primaryPlaceholder: string;
    secondaryLabel?: string;
    secondaryPlaceholder?: string;
    hasAdvanced?: boolean;
  };
  defaultInputs: {
    primary: string;
    secondary?: string;
    advanced?: Record<string, any>;
  };
}

export const STUDIO_SCENARIOS: StudioScenarioDef[] = [
  {
    id: 'token_chat',
    title: 'Token Savings (Chat)',
    description: 'Compare raw vs Spectyra prompt optimization for a chat-style prompt.',
    inputSchema: {
      primaryLabel: 'Chat prompt',
      primaryPlaceholder: 'Paste a chat prompt (1–3 paragraphs).',
      hasAdvanced: true,
    },
    defaultInputs: {
      primary:
        [
          'You are a staff product+engineering copilot.',
          '',
          'Task:',
          '- Write a PRD outline and an execution plan for shipping an internal analytics dashboard by Friday.',
          '',
          'Constraints:',
          '- Keep the plan realistic for a small team (2 engineers).',
          '- Include risk list + mitigation.',
          '- Output: PRD bullets first, then a day-by-day plan.',
          '',
          'Context:',
          '- Audience: CTO + Engineering Manager',
          '- Existing stack: Angular frontend, Node/Express API, Postgres, Supabase auth',
          '- Primary metric: “Weekly active orgs” and “Runs optimized per org”',
          '- Must avoid logging secrets or API keys in analytics',
        ].join('\n'),
      advanced: { showTokenBreakdown: true },
    },
  },
  {
    id: 'token_code',
    title: 'Token Savings (Code)',
    description: 'Compare raw vs Spectyra SCC for coding flows (state + grounding).',
    inputSchema: {
      primaryLabel: 'Coding task',
      primaryPlaceholder: 'Describe the coding task (one paragraph).',
      secondaryLabel: 'Code snippet (optional)',
      secondaryPlaceholder: 'Optional snippet / error / stack trace.',
      hasAdvanced: true,
    },
    defaultInputs: {
      primary:
        [
          'You are an on-call coding agent. Fix the failing build and make the minimal safe change.',
          '',
          'Hard requirements:',
          '- Run tests first and paste full output.',
          '- Do not propose code patches until you read_file the failing file at the failing line.',
          '- Target ES2019; no optional chaining; do not use replaceAll.',
          '- Keep changes minimal; do not refactor unrelated files.',
        ].join('\n'),
      secondary:
        [
          'Context: Monorepo (pnpm workspace). TypeScript + Angular + Node API.',
          '',
          'Observed CI failure:',
          '- command: pnpm install --frozen-lockfile --prefer-offline',
          '- error: ERR_PNPM_OUTDATED_LOCKFILE',
          '  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with <ROOT>/packages/sdk/package.json',
          '  Failure reason:',
          '  specifiers in the lockfile ({"@spectyra/shared":"workspace:*","@types/node":"^20.0.0","typescript":"~5.4.0"})',
          '  don\'t match specs in package.json ({"@types/node":"^20.0.0","typescript":"~5.4.0"})',
          '',
          'Repo facts:',
          '- Root package.json includes "packageManager": "pnpm@9.12.3"',
          '- packages/sdk/package.json has no dependencies, only devDependencies.',
          '',
          'File: packages/sdk/package.json',
          '{',
          '  "name": "@spectyra/sdk",',
          '  "version": "0.1.2",',
          '  "type": "module",',
          '  "files": ["dist", "README.md"],',
          '  "scripts": { "build": "tsc", "prepublishOnly": "npm run build" },',
          '  "dependencies": {},',
          '  "devDependencies": { "@types/node": "^20.0.0", "typescript": "~5.4.0" }',
          '}',
          '',
          'Goal:',
          '- Make `pnpm install --frozen-lockfile --prefer-offline` succeed in CI.',
          '- Do not change published package behavior; only fix install determinism.',
          '- Explain what to commit and why.',
        ].join('\n'),
      advanced: {
        showTokenBreakdown: true,
        rules:
          [
            'Operating rules (must follow):',
            '- If the user asks to run tests/lint: immediately call run_terminal_cmd (do NOT read_file first) and paste the full output.',
            '- Only propose code patches AFTER you read_file the failing file + line.',
            '- Treat .json as JSON (never assume TS/JS content).',
            '- Do not add narration.',
          ].join('\n'),
      },
    },
  },
  {
    id: 'agent_claude',
    title: 'Agent Behavior Flow (Claude SDK)',
    description: 'Demonstrate Spectyra’s code-state grounding rules and “run tests first” behavior.',
    inputSchema: {
      primaryLabel: 'Task goal',
      primaryPlaceholder: 'Describe the agent goal (e.g. “Fix failing tests”).',
      hasAdvanced: true,
    },
    defaultInputs: {
      primary: [
        'You are a structured coding agent inside an app using the Spectyra SDK.',
        '',
        'User request: “Run the full test suite and paste the output. Then fix the error.”',
        '',
        'Constraints:',
        '- Run tests first (tool call).',
        '- Don’t touch unrelated files.',
        '- Target ES2019; no optional chaining; do not use replaceAll.',
        '- Minimal fix only.',
      ].join('\n'),
      secondary: [
        'SYSTEM PROMPT (from app):',
        'You are operating inside an agent runtime. You have tools. You MUST follow tool constraints.',
        '',
        'Available tools:',
        '1) run_terminal_cmd(command: string) -> { stdout, stderr, exitCode }',
        '2) read_file(path: string, startLine?: number, endLine?: number) -> { content }',
        '3) apply_patch(diff: string) -> { ok }',
        '',
        'Policy:',
        '- When asked to run tests, your very next action must be run_terminal_cmd("pnpm -w test").',
        '- No patch proposals before read_file of the failing file + failing line.',
        '- Output must be concise. No narration.',
        '',
        'Failure from last run:',
        "ERROR in apps/web/src/app/features/optimizer-lab/optimizer-lab.page.html:363:75",
        "TS2345: Property 'sccStateChars' does not exist on type 'DiffSummary'.",
        'Stack:',
        '  at OptimizerLabPage_Template (apps/web/src/app/features/optimizer-lab/optimizer-lab.page.html:363:75)',
        '  at executeTemplate (node_modules/@angular/core/fesm2022/core.mjs:...:...)',
        '  at refreshView (node_modules/@angular/core/fesm2022/core.mjs:...:...)',
        '',
        'Relevant files:',
        '- apps/web/src/app/features/optimizer-lab/optimizer-lab.page.html',
        '- apps/web/src/app/core/api/optimizer-lab.service.ts',
        '- apps/api/src/types/optimizerLab.ts',
        '',
        'User says again:',
        '“Run the full test suite and paste the output.”',
      ].join('\n'),
      advanced: {
        rules:
          [
            'Operating rules (must follow):',
            '- If the user asks to run tests/lint: immediately call run_terminal_cmd (do NOT read_file first) and paste the full output.',
            '- Only propose code patches AFTER you read_file the failing file + line.',
            '- Treat .json as JSON (never assume TS/JS content).',
            '- Do not add narration.',
            '',
            'Additional constraints:',
            '- Do not add new dependencies.',
            '- Keep the fix minimal and focused on the failing files.',
          ].join('\n'),
        showPolicyEvaluation: true,
        showToolCalls: true,
      },
    },
  },
  {
    id: 'langchain_rag',
    title: 'LangChain RAG (Large prompt + citations)',
    description: 'Realistic RAG agent prompt: code + logs + citation requirements.',
    inputSchema: {
      primaryLabel: 'Bug / goal',
      primaryPlaceholder: 'Describe the failure and what “correct” looks like.',
      secondaryLabel: 'Context payload (code + logs)',
      secondaryPlaceholder: 'Paste the larger code/config/log block.',
      hasAdvanced: true,
    },
    defaultInputs: {
      primary: [
        'Fix a LangChain RAG agent that is returning hallucinated citations and failing intermittently with “NoneType has no attribute metadata”.',
        '',
        'Requirements:',
        '- Identify root cause from code + logs.',
        '- Propose a minimal patch.',
        '- Add one deterministic test for the failure.',
        '- Ensure the agent says "I don’t know" when context is empty/invalid.',
      ].join('\n'),
      secondary: [
        'Code excerpt (simplified but representative):',
        '',
        '```python',
        'from langchain_openai import ChatOpenAI',
        'from langchain_core.prompts import ChatPromptTemplate',
        'from langchain_core.output_parsers import StrOutputParser',
        'from langchain_community.vectorstores import FAISS',
        'from langchain_community.embeddings import OpenAIEmbeddings',
        '',
        'SYSTEM_RULES = """',
        'You are a support agent.',
        'Always cite sources: [doc_id:line_range].',
        'If sources are missing, say "I don\'t know".',
        '"""',
        '',
        'prompt = ChatPromptTemplate.from_messages([',
        '    ("system", SYSTEM_RULES),',
        '    ("user", "{question}"),',
        '    ("system", "Context:\\n{context}"),',
        '])',
        '',
        'llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)',
        '',
        'db = FAISS.load_local("faiss_index", OpenAIEmbeddings(), allow_dangerous_deserialization=True)',
        '',
        'def retrieve_context(question: str) -> str:',
        '    docs = db.similarity_search(question, k=6)',
        '    # BUG: sometimes docs contains None or doc.page_content is missing',
        '    chunks = []',
        '    for d in docs:',
        '        meta = d.metadata',
        `        chunks.append(f"[{meta.get('doc_id')}:{meta.get('lines')}]\\n{d.page_content}")`,
        '    return "\\n\\n".join(chunks)',
        '',
        'def answer(question: str) -> str:',
        '    context = retrieve_context(question)',
        '    chain = prompt | llm | StrOutputParser()',
        '    return chain.invoke({"question": question, "context": context})',
        '```',
        '',
        'Logs:',
        "- Traceback: AttributeError: 'NoneType' object has no attribute 'metadata'",
        '- Users also report citations like [None:None]',
        '- Regression started after a reindex job',
      ].join('\n'),
      advanced: {
        showTokenBreakdown: true,
        rules: ['- Keep patch minimal; do not change architecture.', '- Do not add narration.'].join('\n'),
      },
    },
  },
  {
    id: 'multi_agent_loop',
    title: 'Multi-agent (AutoGen/CrewAI loop control)',
    description: 'Multi-agent configs often loop; demonstrate governance + retries avoided.',
    inputSchema: {
      primaryLabel: 'Goal',
      primaryPlaceholder: 'What should the agent system do?',
      secondaryLabel: 'Config + logs',
      secondaryPlaceholder: 'Paste config + observed looping logs.',
      hasAdvanced: true,
    },
    defaultInputs: {
      primary: [
        'Debug a multi-agent setup that is looping and re-running the same tool calls.',
        'Goal: stop the loop, enforce max-steps, and ensure tool calls only happen when required.',
      ].join('\n'),
      secondary: [
        'Agents:',
        '- Planner: creates a step plan, must not call tools',
        '- Researcher: can read docs, must cite sources',
        '- Executor: can run tools, must do minimal commands',
        '- Reviewer: checks policy + stops unsafe actions',
        '',
        'Policies:',
        '- max_steps=12',
        '- tool_calls_per_step<=1',
        '- never run destructive commands',
        '- if tests requested, run them first',
        '',
        'Observed behavior:',
        '- Planner emits “run tests” but Executor starts editing code without tests',
        '- Executor repeats “pnpm test” 5x because it sees old failures in history',
        '- Reviewer doesn’t stop it because policy isn’t explicit in the prompt',
        '',
        'Logs (excerpt):',
        'Step 1 Executor: run_terminal_cmd("pnpm test")',
        '(exit 1) FAIL: TS2345 in packages/sdk/src/client.ts:45',
        'Step 2 Executor: run_terminal_cmd("pnpm test")',
        '(exit 1) same failure',
        'Step 3 Executor: proposes patch without reading file',
        '',
        'Ask:',
        '- Rewrite the control prompt/rules so Planner never calls tools.',
        '- Executor runs tests first when asked, then reads failing file, then patches.',
        '- Reviewer blocks repeated test retries without new info.',
      ].join('\n'),
      advanced: {
        showTokenBreakdown: true,
        rules: [
          '- Do not add narration.',
          '- Do not repeat the same tool call twice unless new info was gathered.',
          '- Only propose patches after read_file of failing file + line.',
        ].join('\n'),
      },
    },
  },
];

