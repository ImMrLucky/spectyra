import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatCurrency, formatPercent, formatNumber } from '../../core/util/format';
import type { ReplayResult } from '../../core/api/models';

@Component({
  selector: 'app-savings-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card savings-card">
      <h2>Savings Summary</h2>
      <div class="savings-grid">
        <div class="savings-item">
          <div class="savings-label">Tokens Saved</div>
          <div class="savings-value">{{ formatNumber(result.savings.tokensSaved) }}</div>
        </div>
        <div class="savings-item">
          <div class="savings-label">Percentage Saved</div>
          <div class="savings-value savings-highlight">{{ formatPercent(result.savings.pctSaved) }}</div>
        </div>
        <div class="savings-item">
          <div class="savings-label">Cost Saved</div>
          <div class="savings-value savings-highlight">{{ formatCurrency(result.savings.costSavedUsd) }}</div>
        </div>
      </div>
      
      <div class="quality-status" *ngIf="result.quality.baseline_pass && result.quality.optimized_pass">
        <div class="quality-item">
          <span class="badge badge-success">
            Quality: PASS
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .savings-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .savings-card h2 {
      color: white;
      margin-bottom: 20px;
    }
    .savings-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 20px;
    }
    .savings-item {
      text-align: center;
    }
    .savings-label {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 8px;
    }
    .savings-value {
      font-size: 24px;
      font-weight: 600;
    }
    .savings-highlight {
      font-size: 32px;
    }
    .quality-status {
      display: flex;
      gap: 15px;
      justify-content: center;
    }
  `],
})
export class SavingsCardComponent {
  @Input() result!: ReplayResult;
  
  formatCurrency = formatCurrency;
  formatPercent = formatPercent;
  formatNumber = formatNumber;
}
