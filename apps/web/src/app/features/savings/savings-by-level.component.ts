import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatCurrency, formatPercent, formatNumber } from '../../core/util/format';

@Component({
  selector: 'app-savings-by-level',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './savings-by-level.component.html',
  styleUrls: ['./savings-by-level.component.scss'],
})
export class SavingsByLevelComponent {
  @Input() breakdown: any[] = [];
  @Input() loading = false;
  @Input() showRetryRate = false; // Only show in debug mode
  
  formatCurrency = formatCurrency;
  formatPercent = formatPercent;
  formatNumber = formatNumber;
}
