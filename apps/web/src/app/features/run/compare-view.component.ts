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
  template: `
    <div class="compare-view">
      <div class="debug-toggle">
        <label>
          <input type="checkbox" [(ngModel)]="showDebug" />
          Show advanced debug
        </label>
      </div>
      
      <div class="compare-columns">
        <div class="compare-column">
          <h2>Baseline</h2>
          <app-token-cost-table [run]="result.baseline"></app-token-cost-table>
          <app-tabs-output [run]="result.baseline"></app-tabs-output>
          <app-tabs-prompt [run]="result.baseline" *ngIf="showDebug"></app-tabs-prompt>
          <app-tabs-debug [run]="result.baseline" *ngIf="showDebug"></app-tabs-debug>
        </div>
        
        <div class="compare-column">
          <h2>Optimized</h2>
          <app-token-cost-table [run]="result.optimized"></app-token-cost-table>
          <app-tabs-output [run]="result.optimized"></app-tabs-output>
          <app-tabs-prompt [run]="result.optimized" *ngIf="showDebug"></app-tabs-prompt>
          <app-tabs-debug [run]="result.optimized" *ngIf="showDebug"></app-tabs-debug>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .compare-view {
      margin-top: 20px;
    }
    .debug-toggle {
      margin-bottom: 20px;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 4px;
    }
    .debug-toggle label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 14px;
    }
    .compare-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .compare-column h2 {
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #ddd;
    }
    @media (max-width: 768px) {
      .compare-columns {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class CompareViewComponent {
  @Input() result!: ReplayResult;
  @Input() showDebug = false;
}
