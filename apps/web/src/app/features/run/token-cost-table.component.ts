import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatCurrency, formatNumber } from '../../core/util/format';
import type { RunRecord } from '../../core/api/models';

@Component({
  selector: 'app-token-cost-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <h3>Token Usage & Cost</h3>
      <table class="table">
        <tr>
          <td>Input Tokens</td>
          <td>{{ formatNumber(run.usage.input_tokens) }}</td>
        </tr>
        <tr>
          <td>Output Tokens</td>
          <td>{{ formatNumber(run.usage.output_tokens) }}</td>
        </tr>
        <tr>
          <td>Total Tokens</td>
          <td><strong>{{ formatNumber(run.usage.total_tokens) }}</strong></td>
        </tr>
        <tr>
          <td>Cost</td>
          <td><strong>{{ formatCurrency(run.costUsd) }}</strong></td>
        </tr>
        <tr *ngIf="run.usage.estimated">
          <td colspan="2" class="text-muted"><small>* Estimated tokens</small></td>
        </tr>
      </table>
      
      <div class="quality-badge" *ngIf="run.quality && run.quality.pass">
        <span class="badge badge-success">
          Quality: PASS
        </span>
      </div>
    </div>
  `,
  styles: [`
    .table {
      width: 100%;
      margin-bottom: 15px;
    }
    .table td {
      padding: 8px;
      border-bottom: 1px solid #eee;
    }
    .text-muted {
      color: #666;
    }
    .quality-badge {
      margin-top: 15px;
    }
    .failures {
      margin-top: 5px;
      color: #721c24;
    }
  `],
})
export class TokenCostTableComponent {
  @Input() run!: RunRecord;
  
  formatCurrency = formatCurrency;
  formatNumber = formatNumber;
}
