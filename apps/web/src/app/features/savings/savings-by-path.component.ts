import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatCurrency, formatPercent, formatNumber } from '../../core/util/format';

@Component({
  selector: 'app-savings-by-path',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card" *ngIf="breakdown.length > 0 && !loading">
      <h3>Savings by Path</h3>
      <div class="path-breakdown">
        <div *ngFor="let item of breakdown" class="path-item">
          <div class="path-header">
            <span class="badge" [class.badge-talk]="item.path === 'talk'" [class.badge-code]="item.path === 'code'">
              {{ item.path }}
            </span>
            <span class="path-replays">{{ formatNumber(item.replays) }} replays</span>
          </div>
          <div class="path-stats">
            <div class="stat">
              <div class="stat-label">Tokens Saved</div>
              <div class="stat-value">{{ formatNumber(item.tokens_saved) }}</div>
            </div>
            <div class="stat">
              <div class="stat-label">% Saved</div>
              <div class="stat-value">{{ formatPercent(item.pct_saved) }}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Cost Saved</div>
              <div class="stat-value">{{ formatCurrency(item.cost_saved_usd) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div *ngIf="loading" class="card">
      <div class="loading">Loading...</div>
    </div>
  `,
  styles: [`
    .path-breakdown {
      margin-top: 15px;
    }
    .path-item {
      margin-bottom: 20px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 4px;
    }
    .path-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .path-replays {
      font-size: 14px;
      color: #666;
    }
    .path-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    .stat {
      text-align: center;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 18px;
      font-weight: 600;
      color: #007bff;
    }
    .badge-talk {
      background: #e3f2fd;
      color: #1976d2;
    }
    .badge-code {
      background: #f3e5f5;
      color: #7b1fa2;
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: #666;
    }
  `],
})
export class SavingsByPathComponent {
  @Input() breakdown: any[] = [];
  @Input() loading = false;
  
  formatCurrency = formatCurrency;
  formatPercent = formatPercent;
  formatNumber = formatNumber;
}
