import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatCurrency, formatPercent, formatNumber } from '../../core/util/format';

@Component({
  selector: 'app-savings-by-path',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './savings-by-path.component.html',
  styleUrls: ['./savings-by-path.component.scss'],
})
export class SavingsByPathComponent {
  @Input() breakdown: any[] = [];
  @Input() loading = false;
  
  formatCurrency = formatCurrency;
  formatPercent = formatPercent;
  formatNumber = formatNumber;
}
