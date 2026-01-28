import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MeService } from '../../core/services/me.service';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import type { ProjectSummary } from '@spectyra/shared';

// Extended Project type for UI with additional fields
// API may return more fields than base Project type
interface ProjectWithExtras extends ProjectSummary {
  created_at?: string; // Optional - API may not always return this
  environments?: string[];
  tags?: string[];
  budget?: {
    daily?: number;
    monthly?: number;
  };
  policy_ids?: string[];
}

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './projects.page.html',
  styleUrls: ['./projects.page.scss'],
})
export class ProjectsPage implements OnInit {
  projects: ProjectWithExtras[] = [];
  loading = false;
  error: string | null = null;
  showCreateForm = false;
  newProjectName = '';
  newProjectEnv = 'dev';

  constructor(
    private http: HttpClient,
    private meService: MeService
  ) {}

  async ngOnInit() {
    await this.loadProjects();
  }

  async loadProjects() {
    this.loading = true;
    this.error = null;

    try {
      // Get projects from org info
      // Use MeService to prevent duplicate calls
      const me = await firstValueFrom(this.meService.getMe());
      if (me && me.projects) {
        this.projects = me.projects;
      }
    } catch (err: any) {
      this.error = 'Failed to load projects';
    } finally {
      this.loading = false;
    }
  }
}
