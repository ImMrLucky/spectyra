import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { environment } from '../../../environments/environment';
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
  templateUrl: './savings.page.html',
  styleUrls: ['./savings.page.scss'],
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
  
  constructor(private apiClient: ApiClientService) {}
  
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
    this.apiClient.getProviders().subscribe(providers => {
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
    this.apiClient.getSavingsSummary(this.filters).subscribe({
      next: summary => {
        this.summary = summary;
        this.loading = false;
      },
      error: err => {
        console.error('Summary error:', err);
        this.loading = false;
      },
    });
    
    this.apiClient.getSavingsTimeseries({ ...this.filters, bucket: 'day' }).subscribe({
      next: data => {
        this.timeseries = data;
      },
      error: err => console.error('Timeseries error:', err),
    });
    
    this.apiClient.getSavingsByLevel(this.filters).subscribe({
      next: data => {
        this.byLevel = data;
      },
      error: err => console.error('By-level error:', err),
    });
    
    this.apiClient.getSavingsByPath(this.filters).subscribe({
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
    
    window.open(`${environment.apiUrl}/savings/export?${params}`, '_blank');
  }
}
