import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Project {
  id: string;
  name: string;
  org_id: string;
  created_at: string;
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
  projects: Project[] = [];
  loading = false;
  error: string | null = null;
  showCreateForm = false;
  newProjectName = '';
  newProjectEnv = 'dev';

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    await this.loadProjects();
  }

  async loadProjects() {
    this.loading = true;
    this.error = null;

    try {
      // Get projects from org info
      const me = await this.http.get<any>(`${environment.apiUrl}/auth/me`).toPromise();
      if (me && me.projects) {
        this.projects = me.projects;
      }
    } catch (err: any) {
      this.error = 'Failed to load projects';
    } finally {
      this.loading = false;
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }
}
