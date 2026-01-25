import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatCurrency, formatPercent, formatNumber } from '../../core/util/format';

@Component({
  selector: 'app-savings-kpis',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="kpis-grid" *ngIf="summary && !loading">
      <div class="kpi-card kpi-verified">
        <div class="kpi-label">Verified Savings</div>
        <div class="kpi-value">{{ formatCurrency(summary.verified.cost.saved_usd) }}</div>
        <div class="kpi-subtext">{{ formatPercent(summary.verified.cost.pct_saved) }} saved</div>
        <div class="kpi-badge verified">Verified</div>
      </div>
      
      <div class="kpi-card kpi-total">
        <div class="kpi-label">Total Savings</div>
        <div class="kpi-value">{{ formatCurrency(summary.combined.cost.saved_usd) }}</div>
        <div class="kpi-subtext">{{ formatPercent(summary.combined.cost.pct_saved) }} saved</div>
        <div class="kpi-badge" [class.confidence-high]="getConfidenceBand() === 'High'" 
             [class.confidence-medium]="getConfidenceBand() === 'Medium'"
             [class.confidence-low]="getConfidenceBand() === 'Low'">
          {{ getConfidenceBand() }} Confidence
        </div>
      </div>
      
      <div class="kpi-card">
        <div class="kpi-label">Tokens Saved</div>
        <div class="kpi-value">{{ formatNumber(summary.combined.tokens.saved) }}</div>
        <div class="kpi-subtext">Verified: {{ formatNumber(summary.verified.tokens.saved) }}</div>
      </div>
      
      <div class="kpi-card">
        <div class="kpi-label">Replays</div>
        <div class="kpi-value">{{ formatNumber(summary.runs.replays) }}</div>
        <div class="kpi-subtext">Verified runs</div>
      </div>
    </div>
    
    <div *ngIf="loading" class="loading">Loading...</div>
  `,
  styles: [`
    .kpis-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin: 20px 0;
    }
    .kpi-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
      position: relative;
    }
    .kpi-verified {
      border-left: 4px solid #28a745;
    }
    .kpi-total {
      border-left: 4px solid #007bff;
    }
    .kpi-label {
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
    }
    .kpi-value {
      font-size: 32px;
      font-weight: 600;
      color: #007bff;
      margin-bottom: 4px;
    }
    .kpi-subtext {
      font-size: 12px;
      color: #999;
    }
    .kpi-badge {
      position: absolute;
      top: 10px;
      right: 10px;
      font-size: 10px;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    .kpi-badge.verified {
      background: #d4edda;
      color: #155724;
    }
    .kpi-badge.confidence-high {
      background: #d4edda;
      color: #155724;
    }
    .kpi-badge.confidence-medium {
      background: #fff3cd;
      color: #856404;
    }
    .kpi-badge.confidence-low {
      background: #f8d7da;
      color: #721c24;
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: #666;
    }
    @media (max-width: 768px) {
      .kpis-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `],
})
export class SavingsKpisComponent {
  @Input() summary: any = null;
  @Input() loading = false;
  
  formatCurrency = formatCurrency;
  formatPercent = formatPercent;
  formatNumber = formatNumber;
  
  getConfidenceBand(): "High" | "Medium" | "Low" {
    if (!this.summary?.estimated?.avg_confidence) return "High";
    const conf = this.summary.estimated.avg_confidence;
    if (conf >= 0.85) return "High";
    if (conf >= 0.70) return "Medium";
    return "Low";
  }
}
