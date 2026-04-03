import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OnboardingStateBadgeComponent } from './onboarding-state-badge.component';
import type { OnboardingChecklistItem } from '../models/integration-onboarding.types';

@Component({
  selector: 'app-onboarding-checklist',
  standalone: true,
  imports: [CommonModule, OnboardingStateBadgeComponent],
  template: `
    <ul class="ocl-list">
      <li *ngFor="let item of items" class="ocl-row">
        <app-onboarding-state-badge [state]="item.status" />
        <span class="ocl-label">{{ item.label }}</span>
      </li>
    </ul>
  `,
  styles: [
    `
      .ocl-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .ocl-row {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        color: var(--text-primary, #e8eaed);
      }
    `,
  ],
})
export class OnboardingChecklistComponent {
  @Input({ required: true }) items: OnboardingChecklistItem[] = [];
}
