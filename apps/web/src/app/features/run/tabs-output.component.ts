import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { RunRecord } from '../../core/api/models';

@Component({
  selector: 'app-tabs-output',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <h3>Output</h3>
      <div class="output-content">
        <pre>{{ run.responseText }}</pre>
      </div>
    </div>
  `,
  styles: [`
    .output-content {
      max-height: 400px;
      overflow-y: auto;
      background: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.5;
    }
  `],
})
export class TabsOutputComponent {
  @Input() run!: RunRecord;
}
