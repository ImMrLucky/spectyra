import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { SavingsFiltersComponent } from './savings-filters.component';
import { SavingsKpisComponent } from './savings-kpis.component';
import { SavingsTimeseriesChartComponent } from './savings-timeseries-chart.component';
import { SavingsByLevelComponent } from './savings-by-level.component';
import { SavingsByPathComponent } from './savings-by-path.component';

@Component({
  selector: 'app-savings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SavingsFiltersComponent,
    SavingsKpisComponent,
    SavingsTimeseriesChartComponent,
    SavingsByLevelComponent,
    SavingsByPathComponent,
  ],
  template: `
    <div class="container">
      <h1>Savings Over Time</h1>
      
      <app-savings-filters
        [filters]="filters"
        [providers]="providers"
        (filtersChange)="onFiltersChange($event)">
      </app-savings-filters>
      
      <app-savings-kpis [summary]="summary" [loading]="loading"></app-savings-kpis>
      
      <app-savings-timeseries-chart
        [timeseries]="timeseries"
        [loading]="loading">
      </app-savings-timeseries-chart>
      
      <div class="charts-grid">
        <app-savings-by-level
          [breakdown]="byLevel"
          [loading]="loading">
        </app-savings-by-level>
        
        <app-savings-by-path
          [breakdown]="byPath"
          [loading]="loading">
        </app-savings-by-path>
      </div>
      
      <div class="export-section">
        <button class="btn btn-primary" (click)="exportSavings('verified')">
          Export Verified Savings (CSV)
        </button>
        <button class="btn btn-secondary" (click)="exportSavings('all')">
          Export All Savings (CSV)
        </button>
      </div>
    </div>
  `,
  styles: [`
    .charts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 20px;
    }
    .export-section {
      margin-top: 30px;
      padding: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .btn {
      padding: 10px 20px;
      margin-right: 10px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
    }
    .btn-primary {
      background: #007bff;
      color: white;
    }
    .btn-secondary {
      background: #6c757d;
      color: white;
    }
    @media (max-width: 768px) {
      .charts-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class SavingsPage implements OnInit {
  filters = {
    from: this.getDateDaysAgo(30),
    to: new Date().toISOString().split('T')[0],
    path: 'both' as 'talk' | 'code' | 'both',
    provider: '',
    model: '',
  };
  
  summary: any = null;
  timeseries: any[] = [];
  byLevel: any[] = [];
  byPath: any[] = [];
  providers: any[] = [];
  loading = false;
  
  constructor(private api: ApiClientService) {}
  
  ngOnInit() {
    this.loadProviders();
    this.loadData();
  }
  
  getDateDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }
  
  loadProviders() {
    this.api.getProviders().subscribe(providers => {
      this.providers = providers;
    });
  }
  
  onFiltersChange(newFilters: any) {
    this.filters = { ...this.filters, ...newFilters };
    this.loadData();
  }
  
  loadData() {
    this.loading = true;
    
    // Load all data in parallel
    this.api.getSavingsSummary(this.filters).subscribe({
      next: summary => {
        this.summary = summary;
        this.loading = false;
      },
      error: err => {
        console.error('Summary error:', err);
        this.loading = false;
      },
    });
    
    this.api.getSavingsTimeseries({ ...this.filters, bucket: 'day' }).subscribe({
      next: data => {
        this.timeseries = data;
      },
      error: err => console.error('Timeseries error:', err),
    });
    
    this.api.getSavingsByLevel(this.filters).subscribe({
      next: data => {
        this.byLevel = data;
      },
      error: err => console.error('By-level error:', err),
    });
    
    this.api.getSavingsByPath(this.filters).subscribe({
      next: data => {
        this.byPath = data;
      },
      error: err => console.error('By-path error:', err),
    });
  }
  
  exportSavings(type: 'verified' | 'all') {
    const params = new URLSearchParams();
    if (this.filters.from) params.set('from', this.filters.from);
    if (this.filters.to) params.set('to', this.filters.to);
    if (this.filters.path && this.filters.path !== 'both') params.set('path', this.filters.path);
    if (this.filters.provider) params.set('provider', this.filters.provider);
    if (this.filters.model) params.set('model', this.filters.model);
    params.set('type', type);
    params.set('format', 'csv');
    
    window.open(`${this.api.baseUrl}/savings/export?${params}`, '_blank');
  }
  
  get api() {
    return this.api;
  }
}
