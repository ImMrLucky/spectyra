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

  /** TypeScript — install (strings avoid `@` parsing issues in templates if ever inlined). */
  readonly tsInstall = 'npm install @spectyra/sdk openai';

  readonly tsQuickStart = `import { createSpectyra, createOpenAIAdapter } from "@spectyra/sdk";
import OpenAI from "openai";

const spectyra = createSpectyra({
  runMode: "on",
  spectyraCloudApiKey: process.env.SPECTYRA_API_KEY,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { providerResult, report } = await spectyra.complete(
  {
    provider: "openai",
    client: openai,
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Summarize this support ticket…" }],
  },
  createOpenAIAdapter(),
);

// providerResult: same shape OpenAI would return without Spectyra
// report: tokens, estimated cost, savings %, transforms, etc.
console.log(report.estimatedSavingsPct, report.estimatedSavings);`;

  readonly pyInstall = 'pip install spectyra openai';

  readonly pyQuickStart = `import os
from openai import OpenAI
from spectyra import Spectyra, SpectyraConfig

# Requires a Spectyra local runtime on this URL (BYOK keys live on the runtime).
spectyra = Spectyra(SpectyraConfig(mode="runtime", runtime_base_url=os.environ.get(
    "SPECTYRA_RUNTIME_URL", "http://127.0.0.1:4269"
)))

result = spectyra.run_chat_runtime(
    provider="openai",
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Summarize this support ticket…"}],
)
print(result.output, result.savings_percent)`;

  readonly nextJsExample = `import { createSpectyra, createOpenAIAdapter } from "@spectyra/sdk";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const spectyra = createSpectyra({
  runMode: "on",
  spectyraCloudApiKey: process.env.SPECTYRA_API_KEY,
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const { providerResult, report } = await spectyra.complete(
    { provider: "openai", client: openai, model: "gpt-4o-mini", messages },
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
  runMode: "on",
  spectyraCloudApiKey: process.env.SPECTYRA_API_KEY,
});

app.post("/api/chat", async (req, res) => {
  const { providerResult, report } = await spectyra.complete(
    { provider: "openai", client: openai, model: "gpt-4o-mini", messages: req.body.messages },
    createOpenAIAdapter(),
  );
  res.json({ response: providerResult, savings: report });
});

app.listen(3000);`;

  readonly angularServiceSnippet = `@Injectable({ providedIn: "root" })
export class ChatApiService {
  constructor(private http: HttpClient) {}

  send(messages: Array<{ role: string; content: string }>) {
    return this.http.post<{ response: unknown; savings: unknown }>("/api/chat", { messages });
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
  { provider: "openai", client: openai, model: "gpt-4o-mini", messages },
  createOpenAIAdapter(),
);`;

  readonly productionTelemetryCode = `const spectyra = createSpectyra({
  runMode: "on",
  telemetry: { mode: "cloud_redacted" },
  spectyraCloudApiKey: process.env.SPECTYRA_API_KEY,
});`;

  /** Callback-style alternative to complete() + adapter (same pipeline). */
  readonly tsRunCallbackSnippet = `await spectyra.run(
  { provider: "openai", model: "gpt-4o-mini", messages },
  async (ctx) => {
    const res = await openai.chat.completions.create({
      model: ctx.model,
      messages: ctx.messages,
    });
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
);`;
}
