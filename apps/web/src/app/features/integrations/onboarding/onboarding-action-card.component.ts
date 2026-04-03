import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { OnboardingAction } from '../models/integration-onboarding.types';

@Component({
  selector: 'app-onboarding-action-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="oac">
      <h2 class="oac-title">{{ title }}</h2>
      <p class="oac-body">{{ body }}</p>
      <div class="oac-actions">
        <button
          type="button"
          class="btn-primary"
          *ngFor="let a of primaryActions"
          [disabled]="disabled"
          (click)="actionClick.emit(a)"
        >
          {{ a.label }}
        </button>
        <button
          type="button"
          class="btn-secondary"
          *ngFor="let a of secondaryActions"
          [disabled]="disabled"
          (click)="actionClick.emit(a)"
        >
          {{ a.label }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .oac {
        background: var(--bg-card, rgba(255, 255, 255, 0.04));
        border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
        border-radius: var(--radius-input, 8px);
        padding: 20px 22px;
        margin-top: 16px;
      }
      .oac-title {
        margin: 0 0 8px;
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--text-primary, #fff);
      }
      .oac-body {
        margin: 0 0 16px;
        font-size: 13px;
        line-height: 1.55;
        color: var(--text-secondary, #b8c0cc);
      }
      .oac-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .btn-primary {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        background: var(--spectyra-navy, #1a2744);
        color: var(--spectyra-blue-pale, #e8f4ff);
        font-size: 13px;
        cursor: pointer;
      }
      .btn-primary:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .btn-secondary {
        padding: 8px 14px;
        border: 1px solid var(--border-bright, rgba(255, 255, 255, 0.15));
        border-radius: 6px;
        background: transparent;
        color: var(--text-secondary, #b8c0cc);
        font-size: 13px;
        cursor: pointer;
      }
    `,
  ],
})
export class OnboardingActionCardComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) body = '';
  @Input() actions: OnboardingAction[] = [];
  @Input() disabled = false;
  @Output() actionClick = new EventEmitter<OnboardingAction>();

  get primaryActions(): OnboardingAction[] {
    return this.actions.filter((a) => a.primary);
  }

  get secondaryActions(): OnboardingAction[] {
    return this.actions.filter((a) => !a.primary);
  }
}
