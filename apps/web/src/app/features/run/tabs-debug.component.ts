import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { RunRecord } from '../../core/api/models';

@Component({
  selector: 'app-tabs-debug',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tabs-debug.component.html',
  styleUrls: ['./tabs-debug.component.scss'],
})
export class TabsDebugComponent {
  @Input() run!: RunRecord;
}
