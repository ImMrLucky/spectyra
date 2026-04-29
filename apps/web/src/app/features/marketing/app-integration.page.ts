import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { SnackbarService } from '../../core/services/snackbar.service';

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

  /** Marketing CTAs — absolute URLs for prod and local dev. */
  readonly signupUrl = 'https://spectyra.ai/signup';
  readonly registerUrl = 'https://spectyra.ai/register';

  constructor(
    private supabase: SupabaseService,
    private authService: AuthService,
    private snackbar: SnackbarService,
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

  copyCode(text: string): void {
    void navigator.clipboard.writeText(text).then(
      () => this.snackbar.showSuccess('Copied to clipboard'),
      () => this.snackbar.showError('Could not copy'),
    );
  }

  readonly tsInstall = 'npm install @spectyra/sdk openai';

  readonly tsQuickStart = [
    'import { createSpectyra, createOpenAIAdapter } from "@spectyra/sdk";',
    'import OpenAI from "openai";',
    '',
    'const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });',
    '',
    'const spectyra = createSpectyra({',
    '  spectyraCloudApiKey: process.env.SPECTYRA_API_KEY,',
    '  productSurface: "in_app",',
    '});',
    '',
    'const { providerResult, report } = await spectyra.complete(',
    '  {',
    '    provider: "openai",',
    '    client: openai,',
    '    model: "gpt-4.1-mini",',
    '    messages: [{ role: "user", content: "Summarize this support ticket…" }],',
    '  },',
    '  createOpenAIAdapter(),',
    ');',
    '',
    'console.log(providerResult);',
    '// First "wow": savings live on `report`',
    'console.log(',
    '  `Saved: ${report.estimatedSavingsPct.toFixed(0)}% · $${report.estimatedSavings.toFixed(2)} estimated`,',
    ');',
  ].join('\n');

  readonly pyInstall = 'pip install spectyra';

  readonly pyQuickStart = [
    'import os',
    'from spectyra import Spectyra, SpectyraConfig',
    '',
    '# Runtime mode: HTTP to a Spectyra local/runtime process (provider keys live there).',
    '# For the same in-process BYOK pattern as @spectyra/sdk, use TypeScript/Node today.',
    'spectyra = Spectyra(',
    '    SpectyraConfig(',
    '        mode="runtime",',
    '        runtime_base_url=os.environ.get("SPECTYRA_RUNTIME_URL", "http://127.0.0.1:4269"),',
    '    )',
    ')',
    '',
    'result = spectyra.run_chat_runtime(',
    '    provider="openai",',
    '    model="gpt-4.1-mini",',
    '    messages=[{"role": "user", "content": "Summarize this support ticket…"}],',
    ')',
    'print(result.output)',
    'print(result.savings_percent, result.savings_amount)',
  ].join('\n');

  readonly savingsPreviewExample = `Saved: 42% · $0.18 estimated
runId: a1b2c3d4-…
inferencePath: direct_provider`;

  readonly whatYouGetTs = `{
  providerResult: /* same object OpenAI SDK returns */,
  report: {
    runId: "…",
    provider: "openai",
    model: "gpt-4.1-mini",
    inputTokensBefore: 12400,
    inputTokensAfter: 7100,
    outputTokens: 900,
    estimatedCostBefore: 0.42,
    estimatedCostAfter: 0.24,
    estimatedSavings: 0.18,
    estimatedSavingsPct: 42,
    inferencePath: "direct_provider",
    providerBillingOwner: "customer",
    transformsApplied: ["…"],
    // …plus telemetry / quality hints
  },
  security: { /* inferencePath, telemetryMode, … */ },
}`;

  readonly nextJsExample = `import { createSpectyra, createOpenAIAdapter } from "@spectyra/sdk";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const spectyra = createSpectyra({
  spectyraCloudApiKey: process.env.SPECTYRA_API_KEY,
  productSurface: "in_app",
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const { providerResult, report } = await spectyra.complete(
    { provider: "openai", client: openai, model: "gpt-4.1-mini", messages },
    createOpenAIAdapter(),
  );

  return Response.json({ response: providerResult, savings: report });
}`;

  readonly expressExample = `import express from "express";
import OpenAI from "openai";
import { createSpectyra, createOpenAIAdapter } from "@spectyra/sdk";

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const spectyra = createSpectyra({
  spectyraCloudApiKey: process.env.SPECTYRA_API_KEY,
  productSurface: "in_app",
});

app.post("/api/chat", async (req, res) => {
  const { providerResult, report } = await spectyra.complete(
    { provider: "openai", client: openai, model: "gpt-4.1-mini", messages: req.body.messages },
    createOpenAIAdapter(),
  );

  res.json({ response: providerResult, savings: report });
});

app.listen(3000);`;

  readonly angularServiceSnippet = `import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
export class ChatApiService {
  constructor(private http: HttpClient) {}

  send(messages: Array<{ role: string; content: string }>) {
    return this.http.post("/api/chat", { messages });
  }
}`;

  readonly reactFetchSnippet = `async function sendMessage(messages: Array<{ role: string; content: string }>) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  return res.json();
}`;

  readonly sharedBackendSnippet = `const { providerResult, report } = await spectyra.complete(
  { provider: "openai", client: openai, model: "gpt-4.1-mini", messages },
  createOpenAIAdapter(),
);`;

  readonly productionTelemetryCode = `const spectyra = createSpectyra({
  spectyraCloudApiKey: process.env.SPECTYRA_API_KEY,
  telemetry: { mode: "cloud_redacted" },
  productSurface: "in_app",
});`;

  readonly tsRunCallbackSnippet = `const out = await spectyra.run(
  { provider: "openai", model: "gpt-4.1-mini", messages },
  async ({ messages, model }) => {
    const res = await openai.chat.completions.create({ model, messages });
    const text = res.choices[0]?.message?.content ?? "";
    const u = res.usage;
    return {
      result: res,
      text,
      usage: {
        inputTokens: u?.prompt_tokens ?? 0,
        outputTokens: u?.completion_tokens ?? 0,
      },
    };
  },
);

console.log(out.output);
console.log(out.savingsPercent, out.savingsAmount);
// Full savings report: out.complete.report`;

  readonly overlayDevTs = [
    'import { createSpectyra, createOpenAIAdapter } from "@spectyra/sdk";',
    'import OpenAI from "openai";',
    '',
    'const spectyra = createSpectyra({',
    '  spectyraCloudApiKey: process.env.SPECTYRA_API_KEY,',
    '  environment: process.env.APP_ENV || process.env.NODE_ENV,',
    '  overlay: process.env.SPECTYRA_OVERLAY === "true",',
    '  debug: process.env.SPECTYRA_DEBUG === "true",',
    '  productSurface: "in_app",',
    '});',
    '',
    'spectyra.on("savings", (e) => {',
    '  console.log("savings event", e.traceId, e.savingsPercent);',
    '});',
  ].join('\n');

  readonly overlayDevPy = [
    'import os',
    'from spectyra import Spectyra, SpectyraConfig',
    '',
    'spectyra = Spectyra(',
    '    SpectyraConfig(',
    '        mode="runtime",',
    '        environment=os.environ.get("APP_ENV"),',
    '        overlay=os.environ.get("SPECTYRA_OVERLAY", "").lower() == "true",',
    '        debug=os.environ.get("SPECTYRA_DEBUG", "").lower() == "true",',
    '    )',
    ')',
    '',
    'unsub = spectyra.on_savings(lambda e: print("savings", e.get("trace_id"), e.get("savings_percent")))',
  ].join('\n');
}
