import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatCurrency, formatNumber } from '../../core/util/format';

@Component({
  selector: 'app-savings-timeseries-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './savings-timeseries-chart.component.html',
  styleUrls: ['./savings-timeseries-chart.component.css'],
})
export class SavingsTimeseriesChartComponent {
  @Input() timeseries: any[] = [];
  @Input() loading = false;
  
  padding = 50;
  chartWidth = 800;
  chartHeight = 300;
  
  get maxTokens(): number {
    if (this.timeseries.length === 0) return 1000;
    return Math.max(...this.timeseries.map(d => d.tokens_saved), 1000);
  }
  
  get maxCost(): number {
    if (this.timeseries.length === 0) return 10;
    return Math.max(...this.timeseries.map(d => d.cost_saved_usd), 10);
  }
  
  get yTicks(): number[] {
    const ticks: number[] = [];
    const max = Math.max(this.maxTokens, this.maxCost * 1000); // normalize cost to tokens scale
    const step = max / 5;
    for (let i = 0; i <= 5; i++) {
      ticks.push(this.chartHeight - this.padding - (i * step / max) * (this.chartHeight - 2 * this.padding));
    }
    return ticks;
  }
  
  get xTicks(): Array<{ x: number; label: string }> {
    if (this.timeseries.length === 0) return [];
    const step = Math.max(1, Math.floor(this.timeseries.length / 5));
    return this.timeseries
      .filter((_, i) => i % step === 0 || i === this.timeseries.length - 1)
      .map((d, i) => ({
        x: this.padding + (i * step / (this.timeseries.length - 1)) * (this.chartWidth - 2 * this.padding),
        label: d.date.substring(5), // MM-DD
      }));
  }
  
  get tokensPoints(): string {
    if (this.timeseries.length === 0) return '';
    const max = this.maxTokens;
    return this.timeseries.map((d, i) => {
      const x = this.padding + (i / (this.timeseries.length - 1)) * (this.chartWidth - 2 * this.padding);
      const y = this.chartHeight - this.padding - (d.tokens_saved / max) * (this.chartHeight - 2 * this.padding);
      return `${x},${y}`;
    }).join(' ');
  }
  
  get costPoints(): string {
    if (this.timeseries.length === 0) return '';
    const max = this.maxCost;
    return this.timeseries.map((d, i) => {
      const x = this.padding + (i / (this.timeseries.length - 1)) * (this.chartWidth - 2 * this.padding);
      const y = this.chartHeight - this.padding - (d.cost_saved_usd / max) * (this.chartHeight - 2 * this.padding);
      return `${x},${y}`;
    }).join(' ');
  }
  
  tickValue(y: number): number {
    const max = Math.max(this.maxTokens, this.maxCost * 1000);
    const normalized = (this.chartHeight - this.padding - y) / (this.chartHeight - 2 * this.padding);
    return Math.round(normalized * max);
  }
  
  formatNumber = formatNumber;
}
