import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-app-integration',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app-integration.page.html',
  styleUrls: ['./app-integration.page.scss'],
})
export class AppIntegrationPage implements OnInit, OnDestroy {
  /** JWT session or saved Spectyra API key counts as signed in for this page. */
  isAuthenticated = false;
  private authSub?: Subscription;

  constructor(
    private supabase: SupabaseService,
    private authService: AuthService,
  ) {}

  ngOnInit() {
    this.authSub = combineLatest([this.supabase.getSession(), this.authService.authState])
      .pipe(
        map(([session, auth]) => {
          const jwt = !!session?.access_token;
          const apiKey = !!(auth.apiKey && String(auth.apiKey).trim());
          return jwt || apiKey;
        }),
      )
      .subscribe((v) => {
        this.isAuthenticated = v;
      });
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
  }

  /** Kept in TS so template parsing does not treat `@` / `{` as Angular syntax. */
  readonly installCommand = 'npm install @spectyra/sdk';

  /** Minimal path: install → createSpectyra → complete() with runContext for cloud rollups. */
  readonly quickStartCode = `import { createSpectyra, createOpenAIAdapter } from "@spectyra/sdk";
import OpenAI from "openai";

const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY, // optional — Plan & Billing → license keys; omit = preview-only
});

const openai = new OpenAI();

const { providerResult, report } = await spectyra.complete(
  {
    provider: "openai",
    client: openai,
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Hello!" }],
    runContext: {
      project: "my-service",      // org dashboards / telemetry when cloud mode is on
      environment: "development", // defaults to NODE_ENV when omitted
      service: "api",
      workflowType: "chat",
    },
  },
  createOpenAIAdapter(),
);

console.log(report.estimatedSavingsPct, report.inputTokensBefore, report.inputTokensAfter);`;

  /** Cloud rollups: aggregated costs + safe diagnostics only (see SDK README). */
  readonly productionTelemetryCode = `const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
  telemetry: { mode: "cloud_redacted" },
  spectyraCloudApiKey: process.env.SPECTYRA_CLOUD_API_KEY, // or SPECTYRA_API_KEY
  spectyraApiBaseUrl: process.env.SPECTYRA_API_BASE_URL, // e.g. https://api.example.com/v1
});

// same spectyra.complete(...) — runContext.project / environment tag rows in Projects`;

  readonly devLoggingSnippet = `const { providerResult, report, promptComparison, flowSignals } = await spectyra.complete(input, adapter);

console.log(providerResult);
console.log(report.estimatedSavingsPct, report.inputTokensBefore, report.inputTokensAfter);
console.log(report.estimatedCostBefore, report.estimatedCostAfter, report.estimatedSavings);
console.log(report.transformsApplied, report.notes);
console.log(report.contextReductionPct, report.duplicateReductionPct, report.flowReductionPct);
console.log(report.repeatedContextTokensAvoided, report.repeatedToolOutputTokensAvoided);
console.log(report.messageTurnCount, report.compressibleUnitsHint);
if (promptComparison) console.log(promptComparison.diffSummary);
console.log(flowSignals);`;

  readonly sessionSnippet = `import { createSpectyra, startSpectyraSession } from "@spectyra/sdk";
// …same spectyra instance…

const session = startSpectyraSession(spectyra, { runMode: "on" }, { appName: "my-workflow" });
await session.complete({ /* provider, client, model, messages */ }, adapter);
// more session.complete(...) calls as needed
const aggregated = session.finish();
console.log(aggregated.estimatedWorkflowSavings, aggregated.totalModelCalls);`;

  readonly aliasSnippet = `// Optional: spectyra/* model aliases (same mapping idea as OpenClaw)
const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
  spectyraModelAliasOverrides: { aliasQualityModel: "gpt-4o" },
});

await spectyra.complete(
  { provider: "openai", client: openai, model: "spectyra/quality", messages },
  createOpenAIAdapter(),
);`;
}
