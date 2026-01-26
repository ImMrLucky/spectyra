import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiClientService } from '../../core/api/api-client.service';
import { RunControlsComponent } from './run-controls.component';
import { CompareViewComponent } from './compare-view.component';
import { SavingsCardComponent } from './savings-card.component';
import { OptimizationSliderComponent, type OptimizationLevel } from './optimization-slider.component';
import { getStoredOptimizationLevel, setStoredOptimizationLevel } from '../../core/util/storage';
import type { Scenario, ReplayResult, Provider } from '../../core/api/models';

@Component({
  selector: 'app-run',
  standalone: true,
  imports: [CommonModule, RunControlsComponent, CompareViewComponent, SavingsCardComponent, OptimizationSliderComponent],
  template: `
    <div class="container">
      <h1>{{ scenario?.title || 'Run Scenario' }}</h1>
      
      <app-optimization-slider
        *ngIf="scenario"
        [path]="scenario.path"
        [level]="optimizationLevel"
        (levelChange)="onLevelChange($event)">
      </app-optimization-slider>
      
      <app-run-controls
        [scenario]="scenario"
        [providers]="providers"
        [loading]="loading"
        (runReplay)="onRunReplay($event)">
      </app-run-controls>
      
      <app-savings-card *ngIf="replayResult" [result]="replayResult"></app-savings-card>
      
      <app-compare-view *ngIf="replayResult" [result]="replayResult" [showDebug]="showDebug"></app-compare-view>
    </div>
  `,
})
export class RunPage implements OnInit {
  scenario: Scenario | null = null;
  providers: Provider[] = [];
  replayResult: ReplayResult | null = null;
  loading = false;
  optimizationLevel: OptimizationLevel = 2;
  showDebug = false;
  
  constructor(
    private route: ActivatedRoute,
    private api: ApiClientService
  ) {}
  
  ngOnInit() {
    const scenarioId = this.route.snapshot.paramMap.get('id');
    if (scenarioId) {
      this.api.getScenario(scenarioId).subscribe(scenario => {
        this.scenario = scenario;
        // Load stored optimization level for this path
        this.optimizationLevel = getStoredOptimizationLevel(scenario.path) as OptimizationLevel;
      });
    }
    
    this.api.getProviders().subscribe(providers => {
      this.providers = providers;
    });
  }
  
  onLevelChange(level: OptimizationLevel) {
    this.optimizationLevel = level;
    if (this.scenario) {
      setStoredOptimizationLevel(this.scenario.path, level);
    }
  }
  
  onRunReplay(event: { provider: string; model: string; proofMode: "live" | "estimator" }) {
    if (!this.scenario) return;
    
    this.loading = true;
    this.api.replay(this.scenario.id, event.provider, event.model, this.optimizationLevel, event.proofMode).subscribe({
      next: result => {
        this.replayResult = result;
        this.loading = false;
      },
      error: err => {
        console.error('Replay error:', err);
        this.loading = false;
      },
    });
  }
}
