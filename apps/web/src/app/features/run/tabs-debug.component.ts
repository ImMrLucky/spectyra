import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { RunRecord } from '../../core/api/models';

@Component({
  selector: 'app-tabs-debug',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <h3>Debug Info</h3>
      <div class="debug-content">
        <div *ngIf="run.debug.refsUsed && run.debug.refsUsed.length > 0">
          <strong>REFs Used:</strong>
          <ul>
            <li *ngFor="let ref of run.debug.refsUsed">{{ ref }}</li>
          </ul>
        </div>
        
        <div class="debug-flags">
          <span class="badge" *ngIf="run.debug.deltaUsed">Delta Prompting</span>
          <span class="badge" *ngIf="run.debug.codeSliced">Code Sliced</span>
          <span class="badge" *ngIf="run.debug.patchMode">Patch Mode</span>
        </div>
        
        <div *ngIf="run.debug.spectral" class="spectral-info">
          <h4>Spectral Analysis</h4>
          <table class="table">
            <tr>
              <td>Nodes</td>
              <td>{{ run.debug.spectral.nNodes }}</td>
            </tr>
            <tr>
              <td>Edges</td>
              <td>{{ run.debug.spectral.nEdges }}</td>
            </tr>
            <tr>
              <td>Stability Index</td>
              <td><strong>{{ run.debug.spectral.stabilityIndex.toFixed(3) }}</strong></td>
            </tr>
            <tr *ngIf="run.debug.spectral.lambda2 !== undefined">
              <td>λ₂ (Spectral Gap)</td>
              <td>{{ run.debug.spectral.lambda2.toFixed(4) }}</td>
            </tr>
            <tr *ngIf="run.debug.spectral.contradictionEnergy !== undefined">
              <td>Contradiction Energy</td>
              <td>{{ run.debug.spectral.contradictionEnergy.toFixed(4) }}</td>
            </tr>
            <tr>
              <td>Recommendation</td>
              <td><strong>{{ run.debug.spectral.recommendation }}</strong></td>
            </tr>
            <tr *ngIf="run.debug.retry">
              <td>Retry</td>
              <td><span class="badge badge-warning">Yes (relaxed policy)</span></td>
            </tr>
            <tr *ngIf="run.debug.retry_reason">
              <td>Retry Reason</td>
              <td>{{ run.debug.retry_reason }}</td>
            </tr>
            <tr>
              <td>Stable Units</td>
              <td>{{ run.debug.spectral.stableUnitIds.length }}</td>
            </tr>
            <tr>
              <td>Unstable Units</td>
              <td>{{ run.debug.spectral.unstableUnitIds.length }}</td>
            </tr>
          </table>
        </div>
        
        <div *ngIf="run.quality" class="quality-info">
          <h4>Quality Check</h4>
          <table class="table">
            <tr>
              <td>Status</td>
              <td>
                <span class="badge" [class.badge-success]="run.quality.pass" [class.badge-danger]="!run.quality.pass">
                  {{ run.quality.pass ? 'PASS' : 'FAIL' }}
                </span>
              </td>
            </tr>
            <tr *ngIf="!run.quality.pass && run.quality.failures && run.quality.failures.length > 0">
              <td>Failures</td>
              <td>
                <ul>
                  <li *ngFor="let failure of run.quality.failures">{{ failure }}</li>
                </ul>
              </td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .debug-content {
      font-size: 14px;
    }
    .debug-flags {
      margin: 15px 0;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .spectral-info {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
    }
    .spectral-info h4,
    .quality-info h4 {
      margin-bottom: 10px;
    }
    .quality-info {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
    }
    .table {
      width: 100%;
    }
    .table td {
      padding: 6px;
      border-bottom: 1px solid #eee;
    }
    .badge-warning {
      background: #fff3cd;
      color: #856404;
    }
  `],
})
export class TabsDebugComponent {
  @Input() run!: RunRecord;
}
