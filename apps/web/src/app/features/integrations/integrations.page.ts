import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  COMPARISON_ROWS,
  INTEGRATION_PAGES_BY_SLUG,
  INTEGRATION_SCENARIOS,
  INTEGRATION_SLUG_TO_CARD_ID,
  OPENCLAW_CONFIG_JSON,
  OPENCLAW_FOCUS_SLUGS,
  SCENARIO_CARD_DETAIL_SLUG,
  getIntegrationsPayload,
  type IntegrationCardDefinition,
  type IntegrationComparisonRow,
  type IntegrationPageDefinition,
} from '@spectyra/integration-metadata';

@Component({
  selector: 'app-integrations',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './integrations.page.html',
  styleUrls: ['./integrations.page.scss'],
})
export class IntegrationsPage implements OnInit, OnDestroy {
  readonly payload = getIntegrationsPayload();
  readonly scenarios = INTEGRATION_SCENARIOS;
  readonly openClawConfigJson = OPENCLAW_CONFIG_JSON;

  selectedId: string | null = null;
  /** Current :slug from the URL (may differ from scenario card for tool-specific pages). */
  activeSlug: string | null = null;
  openClawFocused = false;

  private sub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe((pm) => {
      const slug = pm.get('slug');
      this.activeSlug = slug;
      if (slug && INTEGRATION_SLUG_TO_CARD_ID[slug]) {
        this.selectedId = INTEGRATION_SLUG_TO_CARD_ID[slug];
        this.openClawFocused = OPENCLAW_FOCUS_SLUGS.has(slug);
      } else {
        this.selectedId = null;
        this.openClawFocused = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  selectCard(card: IntegrationCardDefinition): void {
    const slug = SCENARIO_CARD_DETAIL_SLUG[card.id];
    const current = this.route.snapshot.paramMap.get('slug');
    if (slug && current === slug) {
      void this.router.navigate(['/integrations'], { replaceUrl: true });
      return;
    }
    if (slug) {
      void this.router.navigate(['/integrations', slug], { replaceUrl: true });
    }
  }

  rowFor(cardId: string): IntegrationComparisonRow | undefined {
    return COMPARISON_ROWS.find((r) => r.id === cardId);
  }

  get pageDetail(): IntegrationPageDefinition | undefined {
    if (this.activeSlug && INTEGRATION_PAGES_BY_SLUG[this.activeSlug]) {
      return INTEGRATION_PAGES_BY_SLUG[this.activeSlug];
    }
    if (!this.selectedId) return undefined;
    const fb = SCENARIO_CARD_DETAIL_SLUG[this.selectedId];
    return fb ? INTEGRATION_PAGES_BY_SLUG[fb] : undefined;
  }

  get selectedCard(): IntegrationCardDefinition | undefined {
    return this.scenarios.find((c) => c.id === this.selectedId);
  }

  copy(text: string): void {
    void navigator.clipboard.writeText(text);
  }
}
