import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ApiClientService } from '../../core/api/api-client.service';
import type { Scenario } from '../../core/api/models';

@Component({
  selector: 'app-scenarios',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './scenarios.page.html',
  styleUrls: ['./scenarios.page.css'],
})
export class ScenariosPage implements OnInit {
  scenarios: Scenario[] = [];
  selectedPath: 'talk' | 'code' | null = null;
  showConnectionsBanner = true;
  
  get filteredScenarios(): Scenario[] {
    if (!this.selectedPath) return this.scenarios;
    return this.scenarios.filter(s => s.path === this.selectedPath);
  }
  
  constructor(
    private api: ApiClientService,
    private router: Router
  ) {
    // Check if user has dismissed banner
    const dismissed = localStorage.getItem('connections-banner-dismissed');
    if (dismissed === 'true') {
      this.showConnectionsBanner = false;
    }
  }
  
  ngOnInit() {
    this.api.getScenarios().subscribe(scenarios => {
      this.scenarios = scenarios;
    });
  }
  
  openScenario(id: string) {
    this.router.navigate(['/scenarios', id, 'run']);
  }
  
  dismissBanner() {
    this.showConnectionsBanner = false;
    localStorage.setItem('connections-banner-dismissed', 'true');
  }
}
