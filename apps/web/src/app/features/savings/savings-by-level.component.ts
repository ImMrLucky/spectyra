import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatCurrency, formatPercent, formatNumber } from '../../core/util/format';

@Component({
  selector: 'app-savings-by-level',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card" *ngIf="breakdown.length > 0 && !loading">
      <h3>Savings by Optimization Level</h3>
      <table class="table">
        <thead>
          <tr>
            <th>Level</th>
            <th>Replays</th>
            <th>Tokens Saved</th>
            <th>% Saved</th>
            <th>Cost Saved</th>
            <th *ngIf="showRetryRate">Retry Rate</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of breakdown">
            <td><strong>Level {{ item.level }}</strong></td>
            <td>{{ formatNumber(item.replays) }}</td>
            <td>{{ formatNumber(item.tokens_saved) }}</td>
            <td>{{ formatPercent(item.pct_saved) }}</td>
            <td>{{ formatCurrency(item.cost_saved_usd) }}</td>
            <td *ngIf="showRetryRate">
              <span *ngIf="item.retry_rate !== undefined" class="badge" [class.badge-warning]="item.retry_rate > 10">
                {{ formatPercent(item.retry_rate) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div *ngIf="loading" class="card">
      <div class="loading">Loading...</div>
    </div>
  `,
  styles: [`
    .table {
      width: 100%;
      margin-top: 15px;
    }
    .badge-warning {
      background: #fff3cd;
      color: #856404;
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: #666;
    }
  `],
})
export class SavingsByLevelComponent {
  @Input() breakdown: any[] = [];
  @Input() loading = false;
  @Input() showRetryRate = false; // Only show in debug mode
  
  formatCurrency = formatCurrency;
  formatPercent = formatPercent;
  formatNumber = formatNumber;
}
