import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-onboarding-state-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="obb"
      [class.success]="state === 'success'"
      [class.pending]="state === 'pending'"
      [class.failure]="state === 'failure'"
    >
      <span class="obb-dot"></span>
    </span>
  `,
  styles: [
    `
      .obb {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
      }
      .obb-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--text-muted, #888);
      }
      .obb.success .obb-dot {
        background: var(--spectyra-teal, #2dd4bf);
      }
      .obb.failure .obb-dot {
        background: #e57373;
      }
      .obb.pending .obb-dot {
        background: var(--spectyra-blue, #378add);
        opacity: 0.6;
      }
    `,
  ],
})
export class OnboardingStateBadgeComponent {
  @Input({ required: true }) state!: 'success' | 'pending' | 'failure';
}
