import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { RunRecord } from '../../core/api/models';

@Component({
  selector: 'app-tabs-prompt',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tabs-prompt.component.html',
  styleUrls: ['./tabs-prompt.component.css'],
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
