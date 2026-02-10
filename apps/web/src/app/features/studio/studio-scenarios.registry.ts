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

/**
 * Realistic multi-turn coding agent transcript (~2,500 tokens).
 * This is what a real Claude Code / Cursor session looks like after several turns:
 * system rules + user task + tool outputs (test logs, file reads) + assistant analysis.
 *
 * SCC should be able to drop older turns and compile a compact state, producing
 * meaningful input-token savings on payloads this size and larger.
 */
const CODE_SCENARIO_TRANSCRIPT = [
  'User: You are an on-call coding agent. The Angular build is failing in CI. Fix the build and make the minimal safe change.',
  '',
  'User: Hard requirements:',
  '- Run the build first and paste full output.',
  '- Do not propose code patches until you read_file the failing file at the failing line.',
  '- Target ES2019; no optional chaining; do not use replaceAll.',
  '- Keep changes minimal; do not refactor unrelated files.',
  '- Treat .json as JSON (never assume TS/JS content).',
  '',
  'Assistant: Understood. I will run the build first to capture the full error output, then read the failing file at the failing line before proposing any patch.',
  '',
  // --- Tool output: build failure (one large tool message) ---
  'Tool: run_terminal_cmd("pnpm --filter web exec ng build")\nexitCode=1\nstdout:\n> web@0.1.0 build /Users/dev/spectyra/apps/web\n> ng build\n\nNode.js version v23.5.0 detected.\nOdd numbered Node.js versions will not enter LTS status and should not be used for production.\n- Building...\n\nApplication bundle generation failed. [14.240 seconds]\n\nX [ERROR] TS2345: Argument of type \'string | undefined\' is not assignable to parameter of type \'string\'.\n  Type \'undefined\' is not assignable to type \'string\'. [plugin angular-compiler]\n\n    src/app/features/integrations/integrations.page.ts:87:42:\n      87 |     this.integrationService.deleteIntegration(integration.id)\n         |                                               ~~~~~~~~~~~~~~\n\nX [ERROR] TS2345: Argument of type \'string | undefined\' is not assignable to parameter of type \'string\'.\n  Type \'undefined\' is not assignable to type \'string\'. [plugin angular-compiler]\n\n    src/app/features/integrations/integrations.page.ts:94:40:\n      94 |     this.integrationService.toggleIntegration(integration.id, !integration.enabled)\n         |                                               ~~~~~~~~~~~~~~\n\nX [ERROR] TS2345: Argument of type \'string | undefined\' is not assignable to parameter of type \'string\'.\n  Type \'undefined\' is not assignable to type \'string\'. [plugin angular-compiler]\n\n    src/app/features/integrations/integrations.page.ts:101:42:\n      101 |     this.integrationService.refreshIntegration(integration.id)\n          |                                                ~~~~~~~~~~~~~~\n\nW [WARNING] NG8107: The left side of this optional chain operation does not include \'null\' or \'undefined\'\n    src/app/features/optimizer-lab/optimizer-lab.page.html:335:73\nW [WARNING] NG8107: The left side of this optional chain operation does not include \'null\' or \'undefined\'\n    src/app/features/optimizer-lab/optimizer-lab.page.html:339:81\nW [WARNING] NG8107: The left side of this optional chain operation does not include \'null\' or \'undefined\'\n    src/app/features/optimizer-lab/optimizer-lab.page.html:343:75\nW [WARNING] NG8107: The left side of this optional chain operation does not include \'null\' or \'undefined\'\n    src/app/features/optimizer-lab/optimizer-lab.page.html:347:84\nW [WARNING] NG8107: The left side of this optional chain operation does not include \'null\' or \'undefined\'\n    src/app/features/optimizer-lab/optimizer-lab.page.html:351:60\nW [WARNING] NG8102: The left side of this nullish coalescing operation does not include \'null\' or \'undefined\'\n    src/app/features/optimizer-lab/optimizer-lab.page.html:355:47',
  '',
  'Assistant: The build has 3 TS2345 errors, all in integrations.page.ts at lines 87, 94, 101. The issue is that integration.id is typed as string | undefined but the service methods expect string. I need to read that file to see the exact code before proposing a fix.',
  '',
  // --- Tool output: read the failing file (one large tool message) ---
  'Tool: read_file("apps/web/src/app/features/integrations/integrations.page.ts")\ncontent:\nimport { Component, OnInit } from \'@angular/core\';\nimport { CommonModule } from \'@angular/common\';\nimport { FormsModule } from \'@angular/forms\';\nimport { MatIconModule } from \'@angular/material/icon\';\nimport { IntegrationService, Integration } from \'../../core/api/integration.service\';\nimport { SnackbarService } from \'../../core/services/snackbar.service\';\n\n@Component({\n  selector: \'app-integrations\',\n  standalone: true,\n  imports: [CommonModule, FormsModule, MatIconModule],\n  templateUrl: \'./integrations.page.html\',\n  styleUrls: [\'./integrations.page.scss\'],\n})\nexport class IntegrationsPage implements OnInit {\n  integrations: Integration[] = [];\n  loading = true;\n  error: string | null = null;\n\n  constructor(\n    private integrationService: IntegrationService,\n    private snackbar: SnackbarService\n  ) {}\n\n  ngOnInit() {\n    this.loadIntegrations();\n  }\n\n  loadIntegrations() {\n    this.loading = true;\n    this.integrationService.getIntegrations().subscribe({\n      next: (data) => {\n        this.integrations = data;\n        this.loading = false;\n      },\n      error: (err) => {\n        this.error = err?.message || \'Failed to load integrations\';\n        this.loading = false;\n      },\n    });\n  }\n\n  deleteIntegration(integration: Integration) {\n    this.integrationService.deleteIntegration(integration.id)\n      .subscribe({\n        next: () => {\n          this.snackbar.showSuccess(\'Integration deleted\');\n          this.loadIntegrations();\n        },\n        error: (err) => this.snackbar.showError(err?.message || \'Delete failed\'),\n      });\n  }\n\n  toggleIntegration(integration: Integration) {\n    this.integrationService.toggleIntegration(integration.id, !integration.enabled)\n      .subscribe({\n        next: () => {\n          this.snackbar.showSuccess(integration.enabled ? \'Disabled\' : \'Enabled\');\n          this.loadIntegrations();\n        },\n        error: (err) => this.snackbar.showError(err?.message || \'Toggle failed\'),\n      });\n  }\n\n  refreshIntegration(integration: Integration) {\n    this.integrationService.refreshIntegration(integration.id)\n      .subscribe({\n        next: () => {\n          this.snackbar.showSuccess(\'Refreshed\');\n          this.loadIntegrations();\n        },\n        error: (err) => this.snackbar.showError(err?.message || \'Refresh failed\'),\n      });\n  }\n}',
  '',
  // --- Tool output: read the service type ---
  'Tool: read_file("apps/web/src/app/core/api/integration.service.ts")\ncontent:\nimport { Injectable } from \'@angular/core\';\nimport { HttpClient } from \'@angular/common/http\';\nimport { Observable } from \'rxjs\';\nimport { environment } from \'../../../environments/environment\';\n\nexport interface Integration {\n  id?: string;\n  name: string;\n  provider: string;\n  enabled: boolean;\n  config: Record<string, any>;\n  createdAt?: string;\n}\n\n@Injectable({ providedIn: \'root\' })\nexport class IntegrationService {\n  constructor(private http: HttpClient) {}\n\n  getIntegrations(): Observable<Integration[]> {\n    return this.http.get<Integration[]>(environment.apiUrl + \'/integrations\');\n  }\n\n  deleteIntegration(id: string): Observable<void> {\n    return this.http.delete<void>(environment.apiUrl + \'/integrations/\' + id);\n  }\n\n  toggleIntegration(id: string, enabled: boolean): Observable<Integration> {\n    return this.http.patch<Integration>(environment.apiUrl + \'/integrations/\' + id, { enabled });\n  }\n\n  refreshIntegration(id: string): Observable<void> {\n    return this.http.post<void>(environment.apiUrl + \'/integrations/\' + id + \'/refresh\', {});\n  }\n}',
  '',
  // --- Tool output: run lint for additional context ---
  'Tool: run_terminal_cmd("pnpm --filter web exec ng lint")\nexitCode=1\nstdout:\n\n/Users/dev/spectyra/apps/web/src/app/features/integrations/integrations.page.ts\n  87:46  error  Argument of type \'string | undefined\' is not assignable to parameter of type \'string\'  @typescript-eslint/no-unsafe-argument\n  94:44  error  Argument of type \'string | undefined\' is not assignable to parameter of type \'string\'  @typescript-eslint/no-unsafe-argument\n  101:46 error  Argument of type \'string | undefined\' is not assignable to parameter of type \'string\'  @typescript-eslint/no-unsafe-argument\n\n/Users/dev/spectyra/apps/web/src/app/features/optimizer-lab/optimizer-lab.page.ts\n  156:5  warning  Unexpected console statement  no-console\n  298:5  warning  Unexpected console statement  no-console\n\n/Users/dev/spectyra/apps/web/src/app/features/studio/studio.page.ts\n  112:7  warning  Unexpected console statement  no-console\n  145:7  warning  Unexpected console statement  no-console\n  201:7  warning  Unexpected console statement  no-console\n\n7 problems (3 errors, 4 warnings)',
  '',
  'Assistant: Both build and lint confirm the same 3 errors in integrations.page.ts. The Integration interface defines id as optional (id?: string), but deleteIntegration, toggleIntegration, and refreshIntegration all require a non-optional string parameter. I also see the lint runs surface 4 console.log warnings in other files but those are unrelated. The fix is to guard the calls with an early return if id is undefined. This is the minimal change that does not alter the interface.',
  '',
  'User: That sounds right. Apply the fix to integrations.page.ts only. Then re-run the build and paste the output to confirm it passes.',
].join('\n');

export const STUDIO_SCENARIOS: StudioScenarioDef[] = [
  {
    id: 'token_chat',
    title: 'Token Savings (Chat)',
    description: 'Compare raw vs Spectyra prompt optimization for a multi-turn chat payload (like real SDKs send).',
    inputSchema: {
      primaryLabel: 'Chat transcript',
      primaryPlaceholder: 'Paste a transcript using "User:" / "Assistant:" turns (recommended).',
      hasAdvanced: true,
    },
    defaultInputs: {
      primary:
        [
          'User: You are a staff product+engineering copilot.',
          '',
          'User: Task: Write a PRD outline and an execution plan for shipping an internal analytics dashboard by Friday.',
          '',
          'User: Constraints: Keep it realistic for 2 engineers. Include risks+mitigations. Output PRD bullets first, then a day-by-day plan.',
          '',
          'Assistant: Got it. Quick clarifier: is this dashboard internal-only (no external customers), and do you need role-based access?',
          '',
          'User: Internal-only. Role-based access is nice-to-have but not required for MVP. Stack is Angular + Node/Express + Postgres + Supabase auth.',
          '',
          'Assistant: Thanks. Any constraints on analytics data retention or logging?',
          '',
          'User: Do not log secrets or API keys. Primary metrics are “Weekly active orgs” and “Runs optimized per org”. Audience is CTO + Engineering Manager.',
        ].join('\n'),
      advanced: { showTokenBreakdown: true },
    },
  },
  {
    id: 'token_code',
    title: 'Token Savings (Code)',
    description: 'Realistic multi-turn coding agent session (~2k+ tokens). Shows SCC compaction on real-sized payloads.',
    inputSchema: {
      primaryLabel: 'Agent transcript',
      primaryPlaceholder: 'Paste a transcript using "User:" / "Assistant:" / "Tool:" turns.',
      secondaryLabel: 'Extra context (optional)',
      secondaryPlaceholder: 'Optional extra logs/snippets.',
      hasAdvanced: true,
    },
    defaultInputs: {
      primary: CODE_SCENARIO_TRANSCRIPT,
      secondary: '',
      advanced: {
        showTokenBreakdown: true,
        optimizationLevel: 3,
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

