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

  readonly quickStartCode = `import { createSpectyra } from "@spectyra/sdk";
import { createOpenAIAdapter } from "@spectyra/sdk/adapters/openai";
import OpenAI from "openai";

// 1) One Spectyra instance (reuse across requests)
const spectyra = createSpectyra({
  runMode: "on", // "observe" = preview savings; provider still gets full prompts
  licenseKey: process.env.SPECTYRA_LICENSE_KEY, // optional — from web Plan & Billing → license keys (see below); omit = preview-only
});

const openai = new OpenAI();

// 2) Wrap the call you already make — same client & model, plus the adapter
const { providerResult, report, promptComparison } = await spectyra.complete(
  {
    provider: "openai",
    client: openai,
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Summarize…" }],
  },
  createOpenAIAdapter(openai),
);

// 3) Use the response + savings metadata
console.log(providerResult); // raw OpenAI response
console.log(report.estimatedSavingsPct, report.inputTokensBefore, report.inputTokensAfter);
console.log(report.transformsApplied, report.notes);
if (promptComparison) console.log(promptComparison.diffSummary);`;

  readonly aliasSnippet = `// Optional: same spectyra/* model aliases as OpenClaw (maps to your real models)
const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
  spectyraModelAliasOverrides: {
    aliasQualityModel: "gpt-4o",
  },
});

await spectyra.complete(
  { provider: "openai", client: openai, model: "spectyra/quality", messages },
  createOpenAIAdapter(openai),
);`;
}
