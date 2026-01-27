import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TokenCostTableComponent } from './token-cost-table.component';
import { TabsOutputComponent } from './tabs-output.component';
import { TabsPromptComponent } from './tabs-prompt.component';
import { TabsDebugComponent } from './tabs-debug.component';
import type { ReplayResult } from '../../core/api/models';

@Component({
  selector: 'app-compare-view',
  standalone: true,
  imports: [CommonModule, FormsModule, TokenCostTableComponent, TabsOutputComponent, TabsPromptComponent, TabsDebugComponent],
  templateUrl: './compare-view.component.html',
  styleUrls: ['./compare-view.component.scss'],
})
export class CompareViewComponent {
  @Input() result!: ReplayResult;
  @Input() showDebug = false;
}
