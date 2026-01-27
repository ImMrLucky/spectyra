import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiClientService } from '../../core/api/api-client.service';
import { formatCurrency, formatNumber } from '../../core/util/format';
import type { RunRecord } from '../../core/api/models';

@Component({
  selector: 'app-runs',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './runs.page.html',
  styleUrls: ['./runs.page.scss'],
})
export class RunsPage implements OnInit {
  runs: RunRecord[] = [];
  
  formatCurrency = formatCurrency;
  formatNumber = formatNumber;
  
  constructor(private api: ApiClientService) {}
  
  ngOnInit() {
    this.api.getRuns(50).subscribe(runs => {
      this.runs = runs;
    });
  }
  
  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }
}
