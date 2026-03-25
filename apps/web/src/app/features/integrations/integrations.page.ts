import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

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
      securityNotes: [
        'Prompts and responses stay on your machine',
        'Provider calls go directly from your machine to the provider',
        'No Spectyra cloud relay for inference',
        'Provider key never leaves your machine',
      ],
      setupSteps: [
        'Download and install the Spectyra Desktop App',
        'Enter your provider API key (stored locally, never uploaded)',
        'Choose run mode (observe recommended to start)',
        'Point your LLM tool (e.g. OpenClaw) to http://127.0.0.1:4111',
        'Run a test and verify savings',
      ],
      verificationSteps: [
        'Open the Desktop App savings dashboard',
        'Confirm inference path shows "Direct to provider"',
        'Confirm telemetry shows "Local only"',
        'Run a prompt and check the before/after comparison',
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
}
