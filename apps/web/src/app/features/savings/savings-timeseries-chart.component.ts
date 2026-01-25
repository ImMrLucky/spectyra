import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatCurrency, formatNumber } from '../../core/util/format';

@Component({
  selector: 'app-savings-timeseries-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card" *ngIf="timeseries.length > 0 && !loading">
      <h3>Savings Over Time</h3>
      <div class="chart-container">
        <svg class="chart" [attr.viewBox]="'0 0 ' + chartWidth + ' ' + chartHeight">
          <!-- Grid lines -->
          <g class="grid">
            <line *ngFor="let y of yTicks" 
              [attr.x1]="padding" 
              [attr.x2]="chartWidth - padding"
              [attr.y1]="y" 
              [attr.y2]="y"
              stroke="#eee" />
          </g>
          
          <!-- Tokens saved line -->
          <polyline
            [attr.points]="tokensPoints"
            fill="none"
            stroke="#007bff"
            stroke-width="2"
          />
          
          <!-- Cost saved line -->
          <polyline
            [attr.points]="costPoints"
            fill="none"
            stroke="#28a745"
            stroke-width="2"
          />
          
          <!-- X axis labels -->
          <g class="x-labels">
            <text *ngFor="let tick of xTicks; let i = index"
              [attr.x]="tick.x"
              [attr.y]="chartHeight - padding + 20"
              text-anchor="middle"
              font-size="10"
              fill="#666">
              {{ tick.label }}
            </text>
          </g>
          
          <!-- Y axis labels (tokens) -->
          <g class="y-labels">
            <text *ngFor="let tick of yTicks"
              [attr.x]="padding - 10"
              [attr.y]="tick"
              text-anchor="end"
              font-size="10"
              fill="#666">
              {{ formatNumber(tickValue(tick)) }}
            </text>
          </g>
          
          <!-- Legend -->
          <g class="legend">
            <line x1="padding" y1="20" x2="padding + 30" y2="20" stroke="#007bff" stroke-width="2" />
            <text [attr.x]="padding + 35" y="25" font-size="12" fill="#333">Tokens Saved</text>
            <line [attr.x1]="padding + 150" y1="20" [attr.x2]="padding + 180" y2="20" stroke="#28a745" stroke-width="2" />
            <text [attr.x]="padding + 185" y="25" font-size="12" fill="#333">Cost Saved</text>
          </g>
        </svg>
      </div>
    </div>
    
    <div *ngIf="loading" class="card">
      <div class="loading">Loading chart data...</div>
    </div>
  `,
  styles: [`
    .chart-container {
      overflow-x: auto;
      margin-top: 20px;
    }
    .chart {
      width: 100%;
      height: 300px;
      min-width: 600px;
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: #666;
    }
  `],
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
