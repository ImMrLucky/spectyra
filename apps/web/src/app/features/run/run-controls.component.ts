import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { Scenario, Provider } from '../../core/api/models';

@Component({
  selector: 'app-run-controls',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card">
      <h2>Run Configuration</h2>
      
      <div class="form-group">
        <label class="form-label">Provider</label>
        <select class="form-select" [(ngModel)]="selectedProvider" (change)="onChange()">
          <option value="">Select provider...</option>
          <option *ngFor="let p of providers" [value]="p.name">{{ p.name }}</option>
        </select>
      </div>
      
      <div class="form-group" *ngIf="selectedProvider">
        <label class="form-label">Model</label>
        <select class="form-select" [(ngModel)]="selectedModel" (change)="onChange()">
          <option value="">Select model...</option>
          <option *ngFor="let m of availableModels" [value]="m">{{ m }}</option>
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Proof Mode</label>
        <div class="proof-mode-toggle">
          <label class="toggle-option">
            <input type="radio" name="proofMode" [(ngModel)]="proofMode" value="live" (change)="onChange()">
            <span>Live</span>
            <span class="toggle-description">Calls real LLM APIs</span>
          </label>
          <label class="toggle-option">
            <input type="radio" name="proofMode" [(ngModel)]="proofMode" value="estimator" (change)="onChange()">
            <span>Estimator</span>
            <span class="toggle-description">Demo mode - no API calls</span>
          </label>
        </div>
      </div>
      
      <button 
        class="btn btn-primary" 
        [disabled]="!canRun || loading"
        (click)="onRun()">
        {{ loading ? 'Running...' : 'Run Replay (Baseline vs Optimized)' }}
      </button>
    </div>
  `,
  styles: [`
    .form-group {
      margin-bottom: 15px;
    }
    .form-label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
    }
    .form-select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .proof-mode-toggle {
      display: flex;
      gap: 16px;
    }
    .toggle-option {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      border: 2px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      flex: 1;
    }
    .toggle-option input[type="radio"] {
      margin: 0;
    }
    .toggle-option input[type="radio"]:checked + span {
      font-weight: 600;
      color: #007bff;
    }
    .toggle-option:has(input[type="radio"]:checked) {
      border-color: #007bff;
      background: #f0f8ff;
    }
    .toggle-description {
      font-size: 12px;
      color: #666;
    }
  `],
})
export class RunControlsComponent {
  @Input() scenario: Scenario | null = null;
  @Input() providers: Provider[] = [];
  @Input() loading = false;
  @Output() runReplay = new EventEmitter<{ provider: string; model: string; proofMode: "live" | "estimator" }>();
  
  selectedProvider = '';
  selectedModel = '';
  proofMode: "live" | "estimator" = "live";
  
  get availableModels(): string[] {
    const provider = this.providers.find(p => p.name === this.selectedProvider);
    return provider?.models || [];
  }
  
  get canRun(): boolean {
    return !!this.selectedProvider && !!this.selectedModel;
  }
  
  onChange() {
    if (!this.availableModels.includes(this.selectedModel)) {
      this.selectedModel = '';
    }
  }
  
  onRun() {
    if (this.canRun) {
      this.runReplay.emit({
        provider: this.selectedProvider,
        model: this.selectedModel,
        proofMode: this.proofMode,
      });
    }
  }
}
