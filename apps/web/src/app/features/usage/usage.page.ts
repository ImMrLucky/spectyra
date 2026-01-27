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

interface BillingStatus {
  subscription_active?: boolean;
  subscription_status?: string;
  trial_ends_at?: string | null;
  has_access?: boolean;
}

interface ProjectUsage {
  id: string;
  name: string;
  calls: number;
  tokens: number;
  cost: number;
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
  billingStatus: BillingStatus | null = null;
  optimizationSavings: OptimizationSavings[] = [];
  projectList: ProjectUsage[] = [];

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

      // Update computed properties
      this.updateComputedProperties();
    } catch (err: any) {
      this.error = 'Failed to load usage data';
    } finally {
      this.loading = false;
    }
  }

  private updateComputedProperties() {
    this.projectList = this.computeProjectList();
  }

  onRangeChange() {
    this.loadData();
  }

  formatCurrency(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  formatNumber(num: number | null | undefined): string {
    if (num === null || num === undefined) return '-';
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

  // Computed properties for usage summary
  get totalCalls(): number {
    return this.usageData.reduce((sum, d) => sum + (d.calls || 0), 0);
  }

  get totalTokens(): number {
    return this.usageData.reduce((sum, d) => sum + (d.tokens || 0), 0);
  }

  get totalCost(): number {
    return this.usageData.reduce((sum, d) => sum + (d.cost_estimate_usd || 0), 0);
  }

  get formattedTotalCalls(): string {
    return this.formatNumber(this.totalCalls);
  }

  get formattedTotalTokens(): string {
    return this.formatNumber(this.totalTokens);
  }

  get formattedTotalCost(): string {
    return this.formatCurrency(this.totalCost);
  }

  // Computed properties for billing status
  get showUpgradeButton(): boolean {
    return this.billingStatus !== null && !this.billingStatus.subscription_active;
  }

  get subscriptionStatusText(): string {
    return this.billingStatus?.subscription_status || 'trial';
  }

  get isSubscriptionActive(): boolean {
    return this.billingStatus?.subscription_active || false;
  }

  get formattedTrialEndsAt(): string {
    return this.formatDate(this.billingStatus?.trial_ends_at || null);
  }

  get hasAccess(): boolean {
    return this.billingStatus?.has_access || false;
  }

  get showTrialEndsAt(): boolean {
    return this.billingStatus !== null && !!this.billingStatus.trial_ends_at;
  }

  get showHasAccess(): boolean {
    return this.billingStatus !== null && !!this.billingStatus.has_access;
  }

  // Computed property for project usage
  get hasProjectUsage(): boolean {
    return this.usageData.length > 0 && 
           this.usageData[0] !== undefined && 
           this.usageData[0].by_project !== undefined;
  }

  // Helper methods
  getBudgetPercentage(budget: BudgetProgress): number {
    if (budget.limit === 0) return 0;
    return (budget.used / budget.limit) * 100;
  }

  getFormattedBudgetUsed(budget: BudgetProgress): string {
    return this.formatCurrency(budget.used);
  }

  getFormattedBudgetLimit(budget: BudgetProgress): string {
    return this.formatCurrency(budget.limit);
  }

  getFormattedBudgetRemaining(budget: BudgetProgress): string {
    return this.formatCurrency(budget.remaining);
  }

  getProjectName(project: ProjectUsage): string {
    return project.name || project.id;
  }

  getFormattedProjectCalls(project: ProjectUsage): string {
    return this.formatNumber(project.calls);
  }

  getFormattedProjectTokens(project: ProjectUsage): string {
    return this.formatNumber(project.tokens);
  }

  getFormattedProjectCost(project: ProjectUsage): string {
    return this.formatCurrency(project.cost);
  }

  getFormattedRunsCount(count: number): string {
    return this.formatNumber(count);
  }

  getFormattedTokensSaved(tokens: number): string {
    return this.formatNumber(tokens);
  }

  private computeProjectList(): ProjectUsage[] {
    if (!this.usageData.length || !this.usageData[0].by_project) {
      return [];
    }
    return Object.entries(this.usageData[0].by_project!).map(([id, data]) => ({
      id,
      name: id, // TODO: Get project name from projects list
      calls: data.calls || 0,
      tokens: data.tokens || 0,
      cost: data.cost || 0,
    }));
  }
}
