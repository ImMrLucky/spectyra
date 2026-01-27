import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { RunRecord } from '../../core/api/models';

@Component({
  selector: 'app-tabs-output',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tabs-output.component.html',
  styleUrls: ['./tabs-output.component.css'],
})
export class TabsOutputComponent {
  @Input() run!: RunRecord;
}
