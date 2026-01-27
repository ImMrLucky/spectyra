import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatCurrency, formatPercent, formatNumber } from '../../core/util/format';
import type { ReplayResult } from '../../core/api/models';

@Component({
  selector: 'app-savings-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './savings-card.component.html',
  styleUrls: ['./savings-card.component.css'],
})
export class SavingsCardComponent {
  @Input() result!: ReplayResult;
  
  formatCurrency = formatCurrency;
  formatPercent = formatPercent;
  formatNumber = formatNumber;
}
