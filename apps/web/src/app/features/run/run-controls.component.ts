import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { Scenario, Provider } from '../../core/api/models';

@Component({
  selector: 'app-run-controls',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './run-controls.component.html',
  styleUrls: ['./run-controls.component.scss'],
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
