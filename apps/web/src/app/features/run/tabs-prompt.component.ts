import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { RunRecord } from '../../core/api/models';

@Component({
  selector: 'app-tabs-prompt',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <h3>Final Prompt</h3>
      <div class="prompt-content">
        <div *ngFor="let msg of messages" class="message">
          <strong>{{ msg.role }}:</strong>
          <pre>{{ msg.content }}</pre>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .prompt-content {
      max-height: 400px;
      overflow-y: auto;
    }
    .message {
      margin-bottom: 15px;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 4px;
    }
    .message strong {
      display: block;
      margin-bottom: 5px;
      color: #007bff;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'Courier New', monospace;
      font-size: 12px;
    }
  `],
})
export class TabsPromptComponent {
  @Input() run!: RunRecord;
  
  get messages(): Array<{ role: string; content: string }> {
    if (Array.isArray(this.run.promptFinal)) {
      return this.run.promptFinal;
    }
    return [];
  }
}
