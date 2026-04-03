import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { IntegrationOnboardingService } from '../integrations/services/integration-onboarding.service';
import { buildChecklistItems, ONBOARDING_COPY } from '../integrations/services/map-onboarding-state';
import { OnboardingChecklistComponent } from '../integrations/onboarding/onboarding-checklist.component';
import { OnboardingActionCardComponent } from '../integrations/onboarding/onboarding-action-card.component';
import { OnboardingDiagnosticsComponent } from '../integrations/onboarding/onboarding-diagnostics.component';
import type { OnboardingAction } from '../integrations/models/integration-onboarding.types';

@Component({
  selector: 'app-openclaw-onboarding',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    OnboardingChecklistComponent,
    OnboardingActionCardComponent,
    OnboardingDiagnosticsComponent,
  ],
  templateUrl: './openclaw-onboarding.page.html',
  styleUrls: ['./openclaw-onboarding.page.scss'],
})
export class OpenClawOnboardingPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly onboarding = inject(IntegrationOnboardingService);

  readonly checklist = computed(() => buildChecklistItems(this.onboarding.status()));

  readonly headline = computed(() => {
    const st = this.onboarding.status().state;
    if (st === 'checking') {
      return { title: 'Connect OpenClaw to Spectyra', body: 'Checking your local setup…' };
    }
    const key = st as keyof typeof ONBOARDING_COPY;
    return ONBOARDING_COPY[key] ?? ONBOARDING_COPY.error;
  });

  readonly productSubtitle =
    'OpenClaw sends requests to Spectyra running locally on your machine. Spectyra optimizes them locally, then sends them directly to your AI provider using your own API keys.';

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    this.onboarding.assumeOpenClawFromFlow =
      q.get('from') === 'clawhub' || q.get('from') === 'openclaw' || q.get('openclaw') === '1';
    void this.onboarding.refreshOpenClawStatus();
  }

  async onAction(a: OnboardingAction): Promise<void> {
    await this.onboarding.executeAction(a.type);
  }

  async onDiagRetry(): Promise<void> {
    await this.onboarding.refreshOpenClawStatus();
  }
}
