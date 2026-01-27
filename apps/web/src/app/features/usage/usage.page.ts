import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface UsageData {
  period: string;
  calls: number;
  tokens: number;
  cost_estimate_usd: number;
  by_project?: { [projectId: string]: { calls: number; tokens: number; cost: number } };
}

interface BudgetProgress {
  budget_type: string;
  limit: number;
  used: number;
  remaining: number;
  period: string;
}

interface OptimizationSavings {
  optimization: string;
  name: string;
  tokens_saved: number;
  runs_count: number;
}

@Component({
  selector: 'app-usage',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './usage.page.html',
  styleUrls: ['./usage.page.scss'],
})
export class UsagePage implements OnInit {
  loading = false;
  error: string | null = null;
  
  selectedRange: '24h' | '7d' | '30d' | '90d' = '30d';
  usageData: UsageData[] = [];
  budgetProgress: BudgetProgress[] = [];
  billingStatus: any = null;
  optimizationSavings: OptimizationSavings[] = [];

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.loading = true;
    this.error = null;

    try {
      // Load usage data
      try {
        const usage = await this.http.get<UsageData[]>(`${environment.apiUrl}/usage?range=${this.selectedRange}`).toPromise();
        this.usageData = usage || [];
      } catch (err: any) {
        // Endpoint might not exist yet
        this.usageData = [];
      }

      // Load budget progress
      try {
        const budgets = await this.http.get<BudgetProgress[]>(`${environment.apiUrl}/usage/budgets`).toPromise();
        this.budgetProgress = budgets || [];
      } catch (err: any) {
        this.budgetProgress = [];
      }

      // Load billing status
      try {
        const billing = await this.http.get<any>(`${environment.apiUrl}/billing/status`).toPromise();
        this.billingStatus = billing;
      } catch (err: any) {
        this.billingStatus = null;
      }

      // Load optimization savings (Core Moat v1)
      try {
        const optimizations = await this.http.get<OptimizationSavings[]>(`${environment.apiUrl}/usage/optimizations?range=${this.selectedRange}`).toPromise();
        this.optimizationSavings = optimizations || [];
      } catch (err: any) {
        this.optimizationSavings = [];
      }
    } catch (err: any) {
      this.error = 'Failed to load usage data';
    } finally {
      this.loading = false;
    }
  }

  onRangeChange() {
    this.loadData();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US').format(num);
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  }

  exportCSV() {
    // TODO: Implement CSV export
    alert('CSV export coming soon');
  }

  getProjectList(): any[] {
    if (!this.usageData.length || !this.usageData[0].by_project) {
      return [];
    }
    return Object.entries(this.usageData[0].by_project!).map(([id, data]) => ({
      id,
      name: id, // TODO: Get project name from projects list
      ...data
    }));
  }
}
