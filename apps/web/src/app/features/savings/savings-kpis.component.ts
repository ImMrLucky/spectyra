import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatCurrency, formatPercent, formatNumber } from '../../core/util/format';

@Component({
  selector: 'app-savings-kpis',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './savings-kpis.component.html',
  styleUrls: ['./savings-kpis.component.css'],
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
