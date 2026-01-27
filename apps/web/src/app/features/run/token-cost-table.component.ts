import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatCurrency, formatNumber } from '../../core/util/format';
import type { RunRecord } from '../../core/api/models';

@Component({
  selector: 'app-token-cost-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './token-cost-table.component.html',
  styleUrls: ['./token-cost-table.component.css'],
})
export class TokenCostTableComponent {
  @Input() run!: RunRecord;
  
  formatCurrency = formatCurrency;
  formatNumber = formatNumber;
}
