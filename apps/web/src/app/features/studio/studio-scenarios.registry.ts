export type StudioScenarioId =
  | 'token_chat'
  | 'token_code'
  | 'agent_claude'
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
        'You are Spectyra. Summarize the user request into 3 bullet points, then ask 1 clarifying question.\n\nUser request: We need a quick plan to ship a dashboard by Friday.',
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
        'Fix the failing build. Run the full test suite and paste the output. Do not propose patches until you read_file the failing file + line.',
      secondary:
        "ERROR in apps/web/src/app/features/optimizer-lab/optimizer-lab.page.html:363\nTS2345: Property 'sccStateChars' does not exist on type 'DiffSummary'.",
      advanced: { showTokenBreakdown: true },
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
      primary: 'Fix failing tests in the SDK. Run tests first and paste output.',
      advanced: {
        rules:
          'Constraints:\n- Target is ES2019; no optional chaining in this file.\n- Do not add new dependencies.\n- If asked to run tests/lint: run_terminal_cmd and paste output.\n- Only propose patches after read_file.',
        showPolicyEvaluation: true,
        showToolCalls: true,
      },
    },
  },
];

