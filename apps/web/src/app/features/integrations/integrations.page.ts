import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OPENCLAW_CONFIG_EXAMPLE_JSON } from './openclaw-config-snippet';

type SetupComplexity = 'low' | 'medium' | 'high';

interface IntegrationCard {
  id: string;
  name: string;
  category: string;
  recommended: boolean;
  requiresCodeChanges: boolean;
  runsWhere: string;
  promptLeavesEnvironment: boolean;
  providerCallPath: string;
  telemetryDefault: string;
  promptSnapshotDefault: string;
  recommendedFirstMode: string;
  securityNotes: string[];
  setupSteps: string[];
  verificationSteps: string[];
  quickstart?: { language: string; code: string };
  /** At-a-glance comparison (spec §8.3) */
  runsLocally: boolean;
  directProviderBilling: boolean;
  goodForOpenClaw: boolean;
  goodForAgentTools: boolean;
  setupComplexity: SetupComplexity;
}

@Component({
  selector: 'app-integrations',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './integrations.page.html',
  styleUrls: ['./integrations.page.scss'],
})
export class IntegrationsPage {
  selectedCard: IntegrationCard | null = null;

  readonly openClawConfigExampleJson = OPENCLAW_CONFIG_EXAMPLE_JSON;

  cards: IntegrationCard[] = [
    {
      id: 'local-companion',
      name: 'Desktop App / Local Companion',
      category: 'No code required',
      recommended: true,
      requiresCodeChanges: false,
      runsWhere: 'Your machine (localhost)',
      promptLeavesEnvironment: false,
      providerCallPath: 'Direct to provider',
      telemetryDefault: 'Local',
      promptSnapshotDefault: 'Local only',
      recommendedFirstMode: 'Observe',
      runsLocally: true,
      directProviderBilling: true,
      goodForOpenClaw: true,
      goodForAgentTools: true,
      setupComplexity: 'low',
      securityNotes: [
        'Prompts and responses stay on your machine by default',
        'Provider calls go directly from your machine to the provider — Spectyra does not proxy live inference through Spectyra servers by default',
        'Your provider API key is used only on your machine',
        'Analytics and prompt snapshots are local by default; optional redacted cloud sync is opt-in',
      ],
      setupSteps: [
        'Install Spectyra Desktop for Mac or Windows and open the app',
        'Choose your real upstream provider (OpenAI, Anthropic, Groq, etc.) and paste your provider API key',
        'Choose run mode: Observe (recommended first) or On; set telemetry to Local and prompt snapshots to Local only by default',
        'Start Local Companion (starts automatically with the app) and confirm status: Base URL http://127.0.0.1:4111/v1, inference path direct to provider',
        'In OpenClaw, add Spectyra as a custom provider under models.providers pointing at that base URL (see example JSON below)',
        'Optionally set OpenClaw default model to spectyra/smart — it is a local routing profile, not a separate vendor; Spectyra forwards to the real model you chose in Desktop',
      ],
      verificationSteps: [
        'Run openclaw models list and confirm spectyra/smart (and spectyra/fast) appear',
        'Run a test prompt in OpenClaw',
        'Open Spectyra Desktop: confirm the run was received, the correct provider was used, savings appear, and prompt comparison is available locally if enabled',
      ],
    },
    {
      id: 'sdk-wrapper',
      name: 'SDK Wrapper',
      category: 'Developer integration',
      recommended: true,
      requiresCodeChanges: true,
      runsWhere: 'Your application process',
      promptLeavesEnvironment: false,
      providerCallPath: 'Direct to provider',
      telemetryDefault: 'Local',
      promptSnapshotDefault: 'Local only',
      recommendedFirstMode: 'Observe',
      runsLocally: true,
      directProviderBilling: true,
      goodForOpenClaw: false,
      goodForAgentTools: true,
      setupComplexity: 'medium',
      securityNotes: [
        'Optimization runs in your process — no external calls for inference',
        'Your provider SDK client makes the actual LLM call',
        'Provider key stays in your environment',
        'Reports are emitted locally; cloud sync is opt-in',
      ],
      setupSteps: [
        'Install @spectyra/sdk or @spectyra/agents',
        'Wrap your provider call with spectyra.complete()',
        'Set runMode to "observe" to start',
        'Review the SavingsReport returned with each call',
      ],
      verificationSteps: [
        'Check SavingsReport.inferencePath is "direct_provider"',
        'Check SavingsReport.providerBillingOwner is "customer"',
        'Confirm no network calls to Spectyra servers during inference',
      ],
      quickstart: {
        language: 'typescript',
        code: `import { createSpectyra, createOpenAIAdapter } from '@spectyra/sdk';
import OpenAI from 'openai';

const spectyra = createSpectyra({
  runMode: 'observe',
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { providerResult, report } = await spectyra.complete(
  {
    provider: 'openai',
    client: openai,
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: 'Hello' }],
  },
  createOpenAIAdapter(),
);

console.log(\`Saved \${report.estimatedSavingsPct.toFixed(1)}%\`);`,
      },
    },
    {
      id: 'observe-preview',
      name: 'Observe / Preview',
      category: 'Try it now',
      recommended: false,
      requiresCodeChanges: false,
      runsWhere: 'Spectyra website (dry-run)',
      promptLeavesEnvironment: false,
      providerCallPath: 'No provider call',
      telemetryDefault: 'Local',
      promptSnapshotDefault: 'Local only',
      recommendedFirstMode: 'Observe',
      runsLocally: false,
      directProviderBilling: false,
      goodForOpenClaw: false,
      goodForAgentTools: false,
      setupComplexity: 'low',
      securityNotes: [
        'No provider call is made',
        'Savings are projected, not realized',
        'No provider key required',
      ],
      setupSteps: [
        'Open Spectyra Studio or Observe page',
        'Paste or select a sample prompt',
        'View projected savings',
      ],
      verificationSteps: [
        'Confirm "No provider call made" label is visible',
        'Review before/after prompt comparison',
      ],
    },
    {
      id: 'legacy-remote-gateway',
      name: 'Legacy Remote Gateway',
      category: 'Advanced / Deprecated',
      recommended: false,
      requiresCodeChanges: true,
      runsWhere: 'Spectyra cloud',
      promptLeavesEnvironment: true,
      providerCallPath: 'Through Spectyra cloud',
      telemetryDefault: 'Cloud',
      promptSnapshotDefault: 'Cloud opt-in',
      recommendedFirstMode: 'On',
      runsLocally: false,
      directProviderBilling: false,
      goodForOpenClaw: false,
      goodForAgentTools: false,
      setupComplexity: 'high',
      securityNotes: [
        'DEPRECATED — prompts are routed through Spectyra servers',
        'Use SDK Wrapper or Local Companion instead',
        'Provider key is sent to Spectyra API (not stored long-term)',
      ],
      setupSteps: [
        'Point your application to the Spectyra /v1/chat endpoint',
        'Set X-SPECTYRA-API-KEY and X-PROVIDER-KEY headers',
      ],
      verificationSteps: [
        'Confirm the response includes optimization metadata',
      ],
    },
  ];

  selectCard(card: IntegrationCard) {
    this.selectedCard = this.selectedCard?.id === card.id ? null : card;
  }

  copyCode(code: string) {
    navigator.clipboard.writeText(code);
  }

  copyOpenClawConfig() {
    navigator.clipboard.writeText(this.openClawConfigExampleJson);
  }
}
