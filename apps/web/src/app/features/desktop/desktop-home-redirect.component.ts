import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DesktopFirstRunService } from '../../core/desktop/desktop-first-run.service';

/** Default route (`''`): first launch → Agent Companion; thereafter → Live. */
@Component({
  standalone: true,
  template: '',
})
export class DesktopHomeRedirectComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly firstRun = inject(DesktopFirstRunService);

  ngOnInit(): void {
    const target = this.firstRun.hasAcknowledgedAgentCompanionGuide()
      ? '/desktop/live'
      : '/desktop/agent-companion';
    void this.router.navigateByUrl(target, { replaceUrl: true });
  }
}
