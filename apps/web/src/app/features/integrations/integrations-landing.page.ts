import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  COMPARISON_ROWS,
  INTEGRATION_SCENARIOS,
  SCENARIO_CARD_DETAIL_SLUG,
  getIntegrationsPayload,
} from '@spectyra/integration-metadata';

@Component({
  selector: 'app-integrations-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './integrations-landing.page.html',
  styleUrls: ['./integrations-shell.scss'],
})
export class IntegrationsLandingPage {
  readonly payload = getIntegrationsPayload();
  readonly scenarios = INTEGRATION_SCENARIOS;
  readonly comparisonRows = COMPARISON_ROWS;

  readonly extraLinks: Record<string, { label: string; slug: string }[]> = {
    'desktop-companion': [{ label: 'OpenClaw', slug: 'openclaw' }],
    'sdk-library': [
      { label: 'Claude Agent SDK', slug: 'claude-agent-sdk' },
      { label: 'OpenAI Agents', slug: 'openai-agents' },
    ],
    'server-sidecar': [{ label: 'Claude Agent SDK', slug: 'claude-agent-sdk' }],
    'events-logs-traces': [{ label: 'Events detail', slug: 'events' }],
  };

  detailSlug(cardId: string): string {
    return SCENARIO_CARD_DETAIL_SLUG[cardId] ?? cardId;
  }

  scenarioTitle(rowId: string): string {
    return this.scenarios.find((s) => s.id === rowId)?.title ?? rowId;
  }
}
