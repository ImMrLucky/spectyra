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
  `],
})
export class RunControlsComponent {
  @Input() scenario: Scenario | null = null;
  @Input() providers: Provider[] = [];
  @Input() loading = false;
  @Output() runReplay = new EventEmitter<{ provider: string; model: string }>();
  
  selectedProvider = '';
  selectedModel = '';
  
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
      });
    }
  }
}
