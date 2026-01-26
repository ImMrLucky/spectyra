import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <h1>Org Settings</h1>
      <p class="subtitle">Configure organization-wide AI Gateway settings</p>
      
      <div class="card">
        <h2>Default Providers</h2>
        <div class="form-group">
          <label class="form-label">Default Talk Provider</label>
          <select class="form-select" [(ngModel)]="defaultTalkProvider">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
            <option value="grok">Grok</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Default Talk Model</label>
          <input type="text" class="form-input" [(ngModel)]="defaultTalkModel" placeholder="gpt-4o-mini">
        </div>
        <div class="form-group">
          <label class="form-label">Default Code Provider</label>
          <select class="form-select" [(ngModel)]="defaultCodeProvider">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
            <option value="grok">Grok</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Default Code Model</label>
          <input type="text" class="form-input" [(ngModel)]="defaultCodeModel" placeholder="claude-3-5-sonnet-20241022">
        </div>
      </div>
      
      <div class="card">
        <h2>Optimizer Thresholds</h2>
        <div class="form-group">
          <label class="form-label">Similarity Reuse Threshold</label>
          <input type="number" class="form-input" [(ngModel)]="similarityThreshold" step="0.01" min="0" max="1">
        </div>
        <div class="form-group">
          <label class="form-label">Stability T_Low</label>
          <input type="number" class="form-input" [(ngModel)]="stabilityTLow" step="0.01" min="0" max="1">
        </div>
        <div class="form-group">
          <label class="form-label">Stability T_High</label>
          <input type="number" class="form-input" [(ngModel)]="stabilityTHigh" step="0.01" min="0" max="1">
        </div>
        <div class="form-group">
          <label class="form-label">Max Output Tokens (Optimized)</label>
          <input type="number" class="form-input" [(ngModel)]="maxOutputTokens" step="1" min="0">
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" [(ngModel)]="codePatchMode"> Code Patch Mode (Default)
          </label>
        </div>
      </div>
      
      <button class="btn btn-primary" (click)="saveSettings()">Save Settings</button>
    </div>
  `,
})
export class SettingsPage {
  defaultTalkProvider = 'openai';
  defaultTalkModel = 'gpt-4o-mini';
  defaultCodeProvider = 'anthropic';
  defaultCodeModel = 'claude-3-5-sonnet-20241022';
  similarityThreshold = 0.90;
  stabilityTLow = 0.35;
  stabilityTHigh = 0.70;
  maxOutputTokens = 450;
  codePatchMode = true;
  
  saveSettings() {
    // In a real app, this would save to backend/localStorage
    alert('Settings saved! (Note: This is a demo - settings are not persisted)');
  }
}
