import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiClientService } from '../../core/api/api-client.service';
import { formatCurrency, formatNumber } from '../../core/util/format';
import type { RunRecord } from '../../core/api/models';

@Component({
  selector: 'app-runs',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="container">
      <h1>Gateway Runs</h1>
      <p class="subtitle">View all optimization runs through the AI Gateway</p>
      
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Scenario</th>
            <th>Mode</th>
            <th>Provider</th>
            <th>Tokens</th>
            <th>Cost</th>
            <th>Quality</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let run of runs">
            <td><code>{{ run.id.substring(0, 8) }}...</code></td>
            <td>{{ run.scenarioId || '-' }}</td>
            <td>
              <span class="badge" [class.badge-baseline]="run.mode === 'baseline'" [class.badge-optimized]="run.mode === 'optimized'">
                {{ run.mode }}
              </span>
            </td>
            <td>{{ run.provider }}/{{ run.model }}</td>
            <td>{{ formatNumber(run.usage.total_tokens) }}</td>
            <td>{{ formatCurrency(run.costUsd) }}</td>
            <td>
              <span class="badge" [class.badge-success]="run.quality.pass" [class.badge-danger]="!run.quality.pass">
                {{ run.quality.pass ? 'PASS' : 'FAIL' }}
              </span>
            </td>
            <td>{{ formatDate(run.createdAt) }}</td>
            <td>
              <a [routerLink]="['/runs', run.id]">View</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .subtitle {
      color: #666;
      font-size: 16px;
      margin-bottom: 20px;
    }
    code {
      font-family: monospace;
      font-size: 12px;
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .badge-baseline {
      background: #e3f2fd;
      color: #1976d2;
    }
    .badge-optimized {
      background: #f3e5f5;
      color: #7b1fa2;
    }
  `],
})
export class RunsPage implements OnInit {
  runs: RunRecord[] = [];
  
  formatCurrency = formatCurrency;
  formatNumber = formatNumber;
  
  constructor(private api: ApiClientService) {}
  
  ngOnInit() {
    this.api.getRuns(50).subscribe(runs => {
      this.runs = runs;
    });
  }
  
  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }
}
