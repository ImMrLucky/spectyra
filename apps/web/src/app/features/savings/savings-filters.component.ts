import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { getStoredSavingsFilters, setStoredSavingsFilters } from '../../core/util/storage';

@Component({
  selector: 'app-savings-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card">
      <h3>Filters</h3>
      <div class="filters-grid">
        <div class="form-group">
          <label class="form-label">Date Range</label>
          <select class="form-select" [(ngModel)]="dateRangePreset" (change)="onDateRangeChange()">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        
        <div class="form-group" *ngIf="dateRangePreset === 'custom'">
          <label class="form-label">From</label>
          <input type="date" class="form-input" [(ngModel)]="filters.from" (change)="onFilterChange()">
        </div>
        
        <div class="form-group" *ngIf="dateRangePreset === 'custom'">
          <label class="form-label">To</label>
          <input type="date" class="form-input" [(ngModel)]="filters.to" (change)="onFilterChange()">
        </div>
        
        <div class="form-group">
          <label class="form-label">Path</label>
          <select class="form-select" [(ngModel)]="filters.path" (change)="onFilterChange()">
            <option value="both">Both</option>
            <option value="talk">Talk</option>
            <option value="code">Code</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Provider</label>
          <select class="form-select" [(ngModel)]="filters.provider" (change)="onFilterChange()">
            <option value="">All Providers</option>
            <option *ngFor="let p of providers" [value]="p.name">{{ p.name }}</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Model</label>
          <select class="form-select" [(ngModel)]="filters.model" (change)="onFilterChange()">
            <option value="">All Models</option>
            <option *ngFor="let m of availableModels" [value]="m">{{ m }}</option>
          </select>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .filters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }
  `],
})
export class SavingsFiltersComponent implements OnInit {
  @Input() filters!: any;
  @Input() providers: any[] = [];
  @Output() filtersChange = new EventEmitter<any>();
  
  dateRangePreset = '30';
  
  get availableModels(): string[] {
    if (!this.filters.provider) {
      // Return all models from all providers
      const allModels = new Set<string>();
      this.providers.forEach(p => p.models.forEach((m: string) => allModels.add(m)));
      return Array.from(allModels);
    }
    const provider = this.providers.find(p => p.name === this.filters.provider);
    return provider?.models || [];
  }
  
  ngOnInit() {
    // Load saved filters
    const saved = getStoredSavingsFilters();
    if (saved) {
      this.filters = { ...this.filters, ...saved };
      this.updateDateRangePreset();
    }
  }
  
  updateDateRangePreset() {
    const daysAgo = this.getDaysAgo(this.filters.from);
    if (daysAgo === 7) this.dateRangePreset = '7';
    else if (daysAgo === 30) this.dateRangePreset = '30';
    else if (daysAgo === 90) this.dateRangePreset = '90';
    else this.dateRangePreset = 'custom';
  }
  
  getDaysAgo(dateStr: string): number {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  onDateRangeChange() {
    if (this.dateRangePreset !== 'custom') {
      const days = parseInt(this.dateRangePreset, 10);
      const date = new Date();
      date.setDate(date.getDate() - days);
      this.filters.from = date.toISOString().split('T')[0];
      this.filters.to = new Date().toISOString().split('T')[0];
      this.onFilterChange();
    }
  }
  
  onFilterChange() {
    setStoredSavingsFilters(this.filters);
    this.filtersChange.emit(this.filters);
  }
}
