import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ModalService } from '../../core/services/modal.service';

interface IntegrationScenario {
  id: string;
  name: string;
  description: string;
  when_to_use: string;
  what_spectyra_controls: string[];
  quickstart: {
    title: string;
    code: string;
    language: string;
  };
  detailed_guide?: {
    where_runs: string;
    code_changes: string;
    data_sent: string;
    auth_works: string;
    verify_works: string;
  };
}

@Component({
  selector: 'app-integrations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './integrations.page.html',
  styleUrls: ['./integrations.page.scss'],
})
export class IntegrationsPage implements OnInit {
  scenarios: IntegrationScenario[] = [];
  selectedScenario: IntegrationScenario | null = null;
  showDetailed = false;
  copiedCode: string | null = null;

  constructor(
    private http: HttpClient,
    private modalService: ModalService
  ) {}

  ngOnInit() {
    this.loadScenarios();
  }

  loadScenarios() {
    // Define integration scenarios
    this.scenarios = [
      {
        id: 'claude-agent-sdk-vm',
        name: 'Claude Agent SDK in VM',
        description: 'Runtime control for agentic workflows with local or API mode',
        when_to_use: 'Building agentic applications with Claude Agent SDK. Need runtime control, tool gating, and telemetry.',
        what_spectyra_controls: [
          'Model selection (haiku/sonnet/opus)',
          'Budget limits per run',
          'Tool permissions (allow/deny)',
          'Permission mode (acceptEdits/bypassPermissions)',
          'Event telemetry',
        ],
        quickstart: {
          title: 'Quick Start (SDK-Local)',
          language: 'typescript',
          code: `import { createSpectyra } from "@spectyra/sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";

const spectyra = createSpectyra({ mode: "local" });

const prompt = "Fix failing tests.";
const options = spectyra.agentOptions({ orgId: "acme" }, prompt);

for await (const evt of query({ prompt, options })) {
  // optional: spectyra.observe(evt)
}`,
        },
        detailed_guide: {
          where_runs: 'Inside your application (same process). Spectyra SDK makes local decisions.',
          code_changes: 'One insertion point: wrap agentOptions() call with spectyra.agentOptions().',
          data_sent: 'No data sent to Spectyra API (local mode). Only metadata if using API mode.',
          auth_works: 'Local mode: no auth needed. API mode: Spectyra API key in environment.',
          verify_works: 'Send a run → Check Runs page → See run appear with events and policy decisions.',
        },
      },
      {
        id: 'claude-agent-sdk-api',
        name: 'Claude Agent SDK (API Control Plane)',
        description: 'Centralized policy management with API control plane',
        when_to_use: 'Enterprise deployments needing centralized governance, budgets, and audit trails.',
        what_spectyra_controls: [
          'Centralized policy enforcement',
          'Org/project-scoped decisions',
          'Budget tracking and limits',
          'Audit logs and telemetry',
        ],
        quickstart: {
          title: 'Quick Start (API Mode)',
          language: 'typescript',
          code: `import { createSpectyra } from "@spectyra/sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";

const spectyra = createSpectyra({
  mode: "api",
  endpoint: process.env.SPECTYRA_ENDPOINT,
  apiKey: process.env.SPECTYRA_API_KEY,
});

const runId = crypto.randomUUID();
const options = await spectyra.agentOptionsRemote(
  { runId },
  { promptChars: prompt.length, path: "code", repoId: "repo_123" }
);

for await (const evt of query({ prompt, options })) {
  await spectyra.sendAgentEvent({ runId }, evt);
}`,
        },
        detailed_guide: {
          where_runs: 'Inside your application. SDK calls Spectyra API for decisions.',
          code_changes: 'Use agentOptionsRemote() instead of agentOptions(). Add sendAgentEvent() calls.',
          data_sent: 'Prompt metadata (length, path, repo) and agent events streamed to Spectyra API.',
          auth_works: 'Spectyra API key required. Sent via X-SPECTYRA-API-KEY header.',
          verify_works: 'Send a run → Check Runs page → See run with full timeline and policy decisions.',
        },
      },
      {
        id: 'chat-apis',
        name: 'Chat APIs (Anthropic/OpenAI)',
        description: 'Direct API integration with drop-in replacement wrapper',
        when_to_use: 'Using OpenAI or Anthropic chat APIs directly. Want optimization without SDK changes.',
        what_spectyra_controls: [
          'Prompt optimization',
          'Token usage reduction',
          'Cost savings tracking',
        ],
        quickstart: {
          title: 'Quick Start',
          language: 'typescript',
          code: `// Replace OpenAI/Anthropic calls with Spectyra endpoint
const response = await fetch('https://spectyra.up.railway.app/v1/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-SPECTYRA-API-KEY': process.env.SPECTYRA_API_KEY,
    'X-PROVIDER-KEY': process.env.OPENAI_API_KEY, // Ephemeral
  },
  body: JSON.stringify({
    path: 'code',
    provider: 'openai',
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello' }]
  })
});`,
        },
        detailed_guide: {
          where_runs: 'Spectyra API acts as middleware between your app and provider APIs.',
          code_changes: 'Change API endpoint URL from provider to Spectyra. Add X-SPECTYRA-API-KEY header.',
          data_sent: 'Full prompts and responses routed through Spectyra (for optimization).',
          auth_works: 'Spectyra API key + ephemeral provider key (never stored).',
          verify_works: 'Send a request → Check Runs page → See optimized run with savings.',
        },
      },
      {
        id: 'langgraph-langchain',
        name: 'LangGraph / LangChain',
        description: 'Framework integrations for agent orchestration',
        when_to_use: 'Using LangGraph or LangChain for agent workflows. Need runtime control.',
        what_spectyra_controls: [
          'Agent model selection',
          'Tool routing decisions',
          'Budget enforcement',
        ],
        quickstart: {
          title: 'Quick Start',
          language: 'typescript',
          code: `// Wrap LangChain agent with Spectyra
import { createSpectyra } from "@spectyra/sdk";
import { AgentExecutor } from "langchain/agents";

const spectyra = createSpectyra({ mode: "api", endpoint, apiKey });

// Use spectyra.agentOptions() to configure agent
const options = await spectyra.agentOptionsRemote(ctx, promptMeta);
const executor = new AgentExecutor({ ...options });

// Execute and stream events
for await (const event of executor.stream()) {
  await spectyra.sendAgentEvent({ runId }, event);
}`,
        },
        detailed_guide: {
          where_runs: 'Inside your application. Spectyra SDK integrates with LangChain/LangGraph.',
          code_changes: 'Wrap agent configuration with spectyra.agentOptions(). Add event streaming.',
          data_sent: 'Agent events and metadata sent to Spectyra API for telemetry.',
          auth_works: 'Spectyra API key required for API mode.',
          verify_works: 'Run agent → Check Runs page → See agent run with events.',
        },
      },
      {
        id: 'server-gateway',
        name: 'Server-Side Gateway (API Mode)',
        description: 'Route all LLM calls through Spectyra gateway endpoint',
        when_to_use: 'Want centralized optimization for all LLM calls. Multiple services/apps.',
        what_spectyra_controls: [
          'All LLM traffic routing',
          'Organization-wide optimization',
          'Usage tracking and budgets',
        ],
        quickstart: {
          title: 'Quick Start',
          language: 'bash',
          code: `# Set environment variables
export SPECTYRA_API_URL=https://spectyra.up.railway.app/v1
export SPECTYRA_API_KEY=your-spectyra-key
export OPENAI_API_KEY=your-openai-key

# Update your app to use Spectyra endpoint
# Change: https://api.openai.com/v1/chat/completions
# To: https://spectyra.up.railway.app/v1/chat`,
        },
        detailed_guide: {
          where_runs: 'Spectyra API acts as gateway. All requests route through it.',
          code_changes: 'Change API endpoint URL. Add X-SPECTYRA-API-KEY header.',
          data_sent: 'All prompts and responses go through Spectyra.',
          auth_works: 'Spectyra API key + ephemeral provider keys.',
          verify_works: 'Send requests → Check Runs page → See all runs with optimization.',
        },
      },
      {
        id: 'on-prem-vpc',
        name: 'On-Prem / VPC',
        description: 'Self-hosted or VPC deployment options',
        when_to_use: 'Enterprise deployments requiring on-premise or VPC isolation.',
        what_spectyra_controls: [
          'Full control plane deployment',
          'Data residency compliance',
          'Private network access',
        ],
        quickstart: {
          title: 'Quick Start',
          language: 'bash',
          code: `# Contact sales for on-prem/VPC deployment
# Includes:
# - Self-hosted Spectyra API
# - Private network access
# - Custom data retention policies
# - Dedicated support`,
        },
        detailed_guide: {
          where_runs: 'Spectyra runs in your infrastructure (on-prem or VPC).',
          code_changes: 'Same as API mode, but endpoint points to your infrastructure.',
          data_sent: 'All data stays within your network. No external calls.',
          auth_works: 'Same API key model, but keys scoped to your deployment.',
          verify_works: 'Same as API mode. Full control plane features available.',
        },
      },
    ];
  }

  selectScenario(scenario: IntegrationScenario) {
    this.selectedScenario = scenario;
    this.showDetailed = false;
  }

  toggleDetailed() {
    this.showDetailed = !this.showDetailed;
  }

  copyCode(code: string, scenarioId: string) {
    navigator.clipboard.writeText(code).then(() => {
      this.copiedCode = scenarioId;
      setTimeout(() => {
        this.copiedCode = null;
      }, 2000);
    });
  }

  async verifyIntegration(scenario: IntegrationScenario) {
    // Generate test run_id
    const testRunId = crypto.randomUUID();
    this.modalService.showInfo(
      'Test Run ID',
      `Test Run ID: ${testRunId}\n\nRun your integration code, then check the Runs page to see if the run appears.`
    );
  }
}
