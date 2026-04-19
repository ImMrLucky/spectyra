import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiClientService } from '../../core/api/api-client.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-project-environment',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './project-environment.page.html',
  styleUrls: ['./project-environment.page.scss'],
})
export class ProjectEnvironmentPage implements OnInit {
  projectId = '';
  environment = '';
  loading = true;
  error: string | null = null;
  detail: {
    environment: string;
    total_calls: number;
    total_savings_usd: number;
    model_usage: Array<{ model: string; calls: number; savings_usd: number }>;
    daily: Array<{ usage_date: string; total_calls: number; total_savings_usd: string }>;
  } | null = null;

  constructor(
    private route: ActivatedRoute,
    private api: ApiClientService,
  ) {}

  async ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
    this.environment = this.route.snapshot.paramMap.get('environmentName') ?? '';
    await this.load();
  }

  async load() {
    this.loading = true;
    this.error = null;
    try {
      this.detail = await firstValueFrom(
        this.api.getProjectEnvironmentSdkDetail(this.projectId, this.environment),
      );
    } catch (e: unknown) {
      const err = e as { error?: { error?: string }; message?: string };
      this.error = err?.error?.error || err?.message || 'Failed to load environment';
    } finally {
      this.loading = false;
    }
  }
}
