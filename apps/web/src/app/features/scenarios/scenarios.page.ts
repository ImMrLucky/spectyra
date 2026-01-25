import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ApiClientService } from '../../core/api/api-client.service';
import type { Scenario } from '../../core/api/models';

@Component({
  selector: 'app-scenarios',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="container">
      <h1>Scenarios</h1>
      
      <div class="filter-tabs">
        <button 
          class="tab-btn" 
          [class.active]="selectedPath === 'talk'"
          (click)="selectedPath = 'talk'">
          Talk
        </button>
        <button 
          class="tab-btn" 
          [class.active]="selectedPath === 'code'"
          (click)="selectedPath = 'code'">
          Code
        </button>
        <button 
          class="tab-btn" 
          [class.active]="selectedPath === null"
          (click)="selectedPath = null">
          All
        </button>
      </div>
      
      <div class="scenarios-grid">
        <div 
          *ngFor="let scenario of filteredScenarios" 
          class="scenario-card card"
          (click)="openScenario(scenario.id)">
          <h3>{{ scenario.title }}</h3>
          <p class="scenario-id">{{ scenario.id }}</p>
          <span class="badge" [class.badge-talk]="scenario.path === 'talk'" [class.badge-code]="scenario.path === 'code'">
            {{ scenario.path }}
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .filter-tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    .tab-btn {
      padding: 8px 16px;
      border: 1px solid #ddd;
      background: white;
      border-radius: 4px;
      cursor: pointer;
    }
    .tab-btn.active {
      background: #007bff;
      color: white;
      border-color: #007bff;
    }
    .scenarios-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
    .scenario-card {
      cursor: pointer;
      transition: transform 0.2s;
    }
    .scenario-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    .scenario-id {
      color: #666;
      font-size: 12px;
      margin: 8px 0;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-talk {
      background: #e3f2fd;
      color: #1976d2;
    }
    .badge-code {
      background: #f3e5f5;
      color: #7b1fa2;
    }
  `],
})
export class ScenariosPage implements OnInit {
  scenarios: Scenario[] = [];
  selectedPath: 'talk' | 'code' | null = null;
  
  get filteredScenarios(): Scenario[] {
    if (!this.selectedPath) return this.scenarios;
    return this.scenarios.filter(s => s.path === this.selectedPath);
  }
  
  constructor(
    private api: ApiClientService,
    private router: Router
  ) {}
  
  ngOnInit() {
    this.api.getScenarios().subscribe(scenarios => {
      this.scenarios = scenarios;
    });
  }
  
  openScenario(id: string) {
    this.router.navigate(['/scenarios', id, 'run']);
  }
}
